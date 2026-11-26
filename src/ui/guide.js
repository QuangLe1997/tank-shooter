// ui/guide.js — Z103 split from ui/menus.js. FIELD MANUAL — the how-to-play screen (first launch + re-openable) and the first-match coach toasts.
import { MOBILE, PROFILE, S, hide, iconEl, refreshStartUI, saveProfile, sfx, show, tapBtn } from '../hub.js';

// ---- HOW TO PLAY: new-player field manual (auto first launch, re-openable) + first-match coach toasts ----
export function buildGuide(){
  const wrap=document.getElementById('guideBody'); if(!wrap) return; wrap.innerHTML='';
  const m=MOBILE;
  const rows=[
    ['bunker','Nhiệm vụ','Bảo vệ LÕI, chiếm các ĐẠI BẢN DOANH rồi vào THÀNH CHÍNH hạ TƯỚNG ĐỊCH. Mỗi màn là một CHIẾN DỊCH — phá MỤC TIÊU viền vàng để lấy điểm và làm địch yếu đi.'],
    ['rifle','Đi và bắn', m?'Kéo cần để đi — bác tài lái theo hướng anh đẩy (cưỡi ngựa thì anh tự cưỡi). Giữ BẮN (hoặc bật TỰ BẮN) để khai hoả.':'WASD để đi · chuột để ngắm · giữ chuột để BẮN · G xuống / lên xe. Xuống đất thì nhảy, khom, bò để ẩn nấp.'],
    ['dash','Kỹ năng', m?'KỸ NĂNG = dùng kỹ năng đang chọn · chạm › để đổi: lựu đạn, lựu khói, cứu thương, gọi tổ bộ binh, drone trinh sát, gây nhiễu (tự lên tay khi có drone địch).':'E = dùng kỹ năng · Q = đổi kỹ năng: lựu đạn, lựu khói, cứu thương, gọi tổ bộ binh. Drone có phím riêng: 9 = trinh sát (đánh dấu địch) · 0 = FPV cảm tử (lái bằng chuột) · I = gây nhiễu.'],
    ['rifle','Súng','Mang súng chính + B41 vào trận. Súng khác nhặt trên chiến trường (địch đánh rơi, thùng SÚNG MỚI) — nhặt trùng thì súng lên ★.'],
    ['up','Quân hàm','Hạ địch để lên quân hàm Binh nhì → Đại tá: mỗi cấp HQ thả thùng quà, thêm người cho tổ, gọi lính dù, không kích.'],
    ['target','Hợp đồng','Trước mỗi màn chọn một HỢP ĐỒNG: chịu thêm rủi ro để mạnh hơn hoặc nhặt nhiều đồ hơn. Muốn đổi chiến trường: Chọn trận ở trang chủ.'],
    ['alert','Sống sót','Nhặt vật phẩm (máu · khiên · bom · drone…). Nấp sau tường, đá, bao cát — nằm sấp thì địch khó thấy hơn.'],
    ['alert','Drone địch','Từ màn 2: nghe tiếng VO VE là có FPV cảm tử — bắn hạ nó (ngắm vào là súng tự bám), nấp sau tường / dưới mái, chui vào khói, hoặc GÂY NHIỄU. Drone trinh sát soi được anh 3 giây thì địch quanh đó biết chỗ và cối sẽ rót — nằm xuống là nó khó thấy.'],
    ['alert','Mối đe doạ','Tổ B40 bắn rocket nổ lan. TRỰC THĂNG tấn công: chờ nó lượn thấp rồi bắn B41. Trực thăng vận tải thả lính xuống thang dây — bắn hạ khi nó đang treo.'],
    ['team','Tổ đồng đội','Anh có tổ riêng (xạ thủ máy, y tá…), thêm người khi lên quân hàm. Họ tự tác chiến, nấp, nhặt đồ mang về KHU TẬP KẾT. U: đổi lệnh tổ.'],
    ['bunker','Trại giam và kho', 'Dọc hàng rào phía ta có TRẠI GIAM lính ta: diệt lính canh rồi áp sát cổng để giải cứu — tù binh cầm súng theo anh. Phía địch có KHO VŨ KHÍ (lính nhận súng chống tăng, tiếp tế): diệt lính canh, thả lính vào vòng xanh vài giây để chiếm.'],
    ['alert','Lính dù', 'Trực thăng vận tải địch thỉnh thoảng thả lính dù xuống VÒNG ĐỎ gần bạn hoặc gần lính ta — đón lõng chỗ tiếp đất.'],
    ['alert','Trận tướng','Tướng địch giữ THÀNH CHÍNH: bước vào thành (hoặc phá tường) là hắn ra trận cùng cận vệ. Hắn bắn quạt và ném chùm lựu đạn — đều có báo trước; dưới nửa máu gọi thêm cận vệ, dưới một phần ba thì nổi điên. Hạ hắn là thắng màn.'],
    ['spark','Vật phẩm','Địch càng khó, chỗ càng hiểm (tháp canh, trại lính, kho tiếp tế) càng rơi đồ xịn. Quầng sáng: xanh lá = thường · xanh dương = hiếm · tím = quý. Nhặt trùng hiệu ứng thì được gia hạn.'],
  ];
  for(const [ic,h,t] of rows){ const r=document.createElement('div'); r.className='guide-row';
    r.innerHTML='<span class="g-ic"></span><div class="g-tx"><b>'+h+'</b><span>'+t+'</span></div>';
    r.querySelector('.g-ic').appendChild(iconEl(ic)); wrap.appendChild(r); }
}
export function openGuide(){ buildGuide(); hide('start'); hide('nick'); show('guide'); sfx('click'); }
export function closeGuide(){ hide('guide'); if(!PROFILE.onboarded){ PROFILE.onboarded=true; saveProfile(); } show('start'); refreshStartUI(); sfx('click'); }
tapBtn('guideBtn', openGuide); tapBtn('guideDone', closeGuide); tapBtn('guideBack', closeGuide);
export let _coachT=null;
export function coach(msg){ const el=document.getElementById('coach'); if(!el) return; el.textContent=msg; el.classList.add('on'); clearTimeout(_coachT); _coachT=setTimeout(()=>el.classList.remove('on'), 3200); }
export function coachFirstRun(){
  if(PROFILE.coached) return; PROFILE.coached=true; saveProfile();
  const tips = MOBILE
    ? ['Kéo cần để đi — bác tài lái theo hướng anh đẩy','Bảo vệ LÕI — đừng để nó sụp','Vào THÀNH CHÍNH để hạ TƯỚNG ĐỊCH','Nhặt vật phẩm để sống sót']
    : ['WASD để đi · chuột để ngắm · giữ chuột để BẮN','G để xuống / lên xe','Bảo vệ LÕI — đừng để nó sụp','Vào THÀNH CHÍNH để hạ TƯỚNG ĐỊCH'];
  tips.forEach((t,i)=> setTimeout(()=>{ if(S.mode==='playing') coach(t); }, 1500 + i*3400));
}
