// ui/tips.js — Z94 · FIRST-TIME TIPS — the first time something new happens, a short field note explains it (Z168: a side card, the battle keeps running). Once per lifetime (saved).
import { MOBILE, PROFILE, S, iconEl, saveProfile, sfx, tapEl } from '../hub.js';

// ===== Z94 · FIRST-TIME TIPS — the first time something new happens, the battle PAUSES and a short field note explains it. Once per lifetime (saved). =====
export const TIPS={
  drive2:  ['rifle','Đi và bắn', (MOBILE ? 'Đẩy cần về hướng muốn đi — bác tài lái theo (cưỡi ngựa thì anh tự cưỡi). Giữ <b>BẮN</b> hoặc bật <b>TỰ BẮN</b>.' : '<b>WASD</b> để đi · <b>chuột</b> để ngắm · giữ <b>chuột</b> để bắn.')+' <b>G</b>: xuống / lên xe — xuống đất thì nhảy, khom, bò để ẩn nấp; gọi bác tài tới đón khi cần.'],
  infantry:['team','Bộ binh địch', 'Lính đi bộ yếu nhưng đông. Tổ <b>RPG</b> quỳ ngắm 1 giây có <b>chớp đỏ</b> — né ra khỏi đường đạn. Phi ngựa nước đại thì giẫm ngã được lính địch.'],
  loot:    ['spark','Vật phẩm rơi', 'Đồ rơi văng ra từ địch bị hạ. <b>Quầng sáng</b> quanh món đồ cho biết độ hiếm: <b>xanh lá</b> thường · <b>xanh dương</b> hiếm · <b>tím</b> quý. Địch càng khó, chỗ càng hiểm thì đồ càng xịn. Lại gần là đồ tự hút vào.'],
  stack:   ['bolt','Cộng dồn vật phẩm', 'Nhặt lại hiệu ứng đang có thì được <b>gia hạn thêm nửa thời gian</b> (tối đa 1,5 lần), không mạnh thêm. <b>TĂNG ÁP</b> lên tới cấp 2, <b>giáp phản ứng</b> tối đa 6 tấm. Tốc độ tối đa có trần ×1,7.'],
  objective:['bunker','Mục tiêu chiến dịch', 'Công trình viền vàng làm địch mạnh hơn khi còn đứng (xem dòng mô tả trên màn hình). <b>Phá nó</b> để lấy điểm và cắt nguồn sức mạnh của địch.'],
  camp:    ['bunker','Trại lính địch', 'Nhà vòm tôn liên tục tung lính ra. <b>San phẳng nhà lính</b> để chặn nguồn quân. Lều thì cán bẹp được. Phá trại rơi đồ <b>quý</b>.'],
  gunship: ['drone','Trực thăng vũ trang', 'Đạn pháo vòng cung không với tới. Dùng <b>súng bắn thẳng, PHÁO PHÒNG KHÔNG</b> (×1,8 vào máy bay) hoặc <b>tên lửa</b>.'],
  elite:   ['star','Địch tinh nhuệ', 'Địch có hào quang vàng: trâu hơn, mạnh hơn nhưng <b>luôn rơi đồ quý</b> và nhiều điểm hơn.'],
  core:    ['bunker','Lõi đang nguy!', 'Nếu <b>LÕI</b> bị phá là thua. Quay về đánh bật địch quanh Lõi, dùng kỹ năng <b>SỬA CHỮA</b> hoặc nhặt <b>SỬA CĂN CỨ</b>.'],
  deploy:  ['team','Bố trí trận địa', 'Trước mỗi màn bạn <b>chia quân</b>: bao nhiêu người <b>giữ Lõi</b>, áp sát <b>trại giam / kho</b>, giữ <b>hai cánh</b>. Chọn thêm <b>súng máy</b>, <b>cối</b>, <b>công binh</b> (đánh sập tháp canh). Lính được bố trí sẽ <b>giữ khu vực</b> của mình. Lần sau tự nhớ cách bố trí.'],
  pow:     ['team','Trại giam lính ta', 'Lính ta bị giam sau hàng rào thép gai. <b>Diệt hết lính canh</b>, rồi <b>lái xe tới cổng</b> (hoặc cho lính đi bộ vào): tù binh <b>lên xe</b> — đầy chỗ thì họ <b>cầm súng theo bạn</b>.'],
  depot:   ['bunker','Kho vũ khí địch', 'Diệt lính canh, rồi <b>thả lính xuống</b> trong vòng xanh vài giây để <b>chiếm kho</b>. Kho phát <b>súng chống tăng</b> cho lính ta và tung đồ tiếp tế.'],
  rally:   ['spark','Khu tập kết', 'Lính nhặt được vật phẩm sẽ <b>mang về khu tập kết</b> (vòng xanh có cờ, bên phía ta). Đồ ở đó <b>không biến mất</b> — lái xe tới để nhận.'],
  paradrop:['alert','Lính dù địch!', 'Trực thăng vận tải thả lính dù xuống <b>vòng đỏ</b>. Đón lõng chỗ họ tiếp đất — <b>một phát pháo</b> là đủ hạ một lính.'],
};
export const TIPQ=[]; export let _tipOpen=null;
// Z104 only the notes that change how you play stop the battle; simple sightings stay quiet (still in the field manual)
export const TIP_SHOW={ deploy:1, drive2:1, core:1, pow:1, depot:1, rally:1, paradrop:1 };
export function tip(id){ if(!TIPS[id] || !TIP_SHOW[id]) return; const P=PROFILE.tips||(PROFILE.tips={}); if(P[id] || TIPQ.includes(id) || _tipOpen===id) return; TIPQ.push(id); }
export const TIP_URGENT={ arty:1, atgm:1, boss:1, shield:1, core:1 }; export let _tipNextAt=0;
export function pumpTips(){ if(_tipOpen || !TIPQ.length || S.mode!=='playing') return; const nowT=performance.now()/1000;
  let qi=TIPQ.findIndex(k=>TIP_URGENT[k]); if(qi<0){ if(nowT<_tipNextAt) return; qi=0; }      // urgent notes jump the queue; the rest wait 6 s of play between them
  const id=TIPQ.splice(qi,1)[0], T=TIPS[id], el=document.getElementById('tipCard'); if(!el) return;
  _tipOpen=id; _tipUntil=nowT+tipSecs();   // Z168 no more pausing the battle: a side card that dismisses itself (a pad could never close the old modal → the game looked frozen)
  el.querySelector('.tc-ic').replaceChildren(iconEl(T[0])); el.querySelector('.tc-ttl').textContent=T[1]; el.querySelector('.tc-body').innerHTML=T[2];
  const seen=Object.keys(TIP_SHOW).filter(k=>(PROFILE.tips||{})[k]).length+1; el.querySelector('.tc-n').textContent='Ghi chú '+Math.min(seen, Object.keys(TIP_SHOW).length)+'/'+Object.keys(TIP_SHOW).length;
  el.classList.remove('hidden','away'); const bar=el.querySelector('.tc-bar'); if(bar){ bar.style.animation='none'; void bar.offsetWidth; bar.style.animation='tcbar '+tipSecs()+'s linear forwards'; } sfx('beep'); }
export function closeTip(quiet){ if(!_tipOpen) return; (PROFILE.tips||(PROFILE.tips={}))[_tipOpen]=1; saveProfile(); _tipOpen=null; _tipNextAt=performance.now()/1000+(MOBILE?TIP_GAP_TOUCH:6); document.getElementById('tipCard').classList.add('hidden'); if(S.mode==='tip') S.mode='playing'; if(!quiet) sfx('click'); }
export const TIP_SECS=11, TIP_SECS_TOUCH=8, TIP_GAP_TOUCH=20; let _tipUntil=0;   // Z183 on a phone a note is shorter-lived and they come far apart (the screen is small)
function tipSecs(){ return MOBILE ? TIP_SECS_TOUCH : TIP_SECS; }
// every frame: the card waits while a menu / pause / result screen is up, and closes itself when its time is over
export function tickTip(){ const el=_tipOpen && document.getElementById('tipCard'); if(!el) return; const away=S.mode!=='playing'; el.classList.toggle('away', away);
  if(away){ _tipUntil+=1/60; return; } if(performance.now()/1000>_tipUntil) closeTip(true); }
{ const ok=document.getElementById('tipOk'); if(ok) tapEl(ok, ()=>closeTip()); }   // Z168 keys stay with the game (Space / Enter used to be swallowed by the card)
