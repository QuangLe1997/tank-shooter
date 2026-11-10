// ui/guide.js — Z103 split from ui/menus.js. FIELD MANUAL — the how-to-play screen (first launch + re-openable) and the first-match coach toasts.
import { MOBILE, PROFILE, S, hide, iconEl, refreshStartUI, saveProfile, sfx, show, tapBtn } from '../hub.js';

// ---- HOW TO PLAY: new-player field manual (auto first launch, re-openable) + first-match coach toasts ----
export function buildGuide(){
  const wrap=document.getElementById('guideBody'); if(!wrap) return; wrap.innerHTML='';
  const m=MOBILE;
  const rows=[
    ['bunker','NHIỆM VỤ','Bảo vệ LÕI qua 5 đợt tấn công rồi hạ TƯỚNG ĐỊCH. Mỗi màn là một CHIẾN DỊCH — phá MỤC TIÊU viền vàng để nhận thưởng + 💎.'],
    ['tank', m?'LÁI XE':'LÁI & NGẮM', m?'Kéo cần để lái. Nòng pháo GẮN CỐ ĐỊNH theo đầu xe: xe quay về hướng nào là bắn thẳng hướng đó — quay mũi xe vào địch rồi khai hoả.':'W tiến · S lùi · A/D quay thân xe (như xe tăng thật) · chuột ngắm tháp pháo · giữ chuột để BẮN. Đổi sang lái theo hướng màn hình trong CÀI ĐẶT.'],
    ['dash','LƯỚT & KỸ NĂNG', m?'LƯỚT = né nhanh, bất tử chốc lát · KỸ NĂNG = dùng kỹ năng đang chọn · chạm › để đổi kỹ năng.':'CÁCH = lướt (bất tử chốc lát) · E = dùng kỹ năng · Q = đổi kỹ năng.'],
    ['rifle','KHO SÚNG','Nhặt súng từ đồ rơi & CỬA HÀNG. Mang tối đa 5 khẩu và đổi giữa trận — mỗi khẩu một cảm giác & màu đạn riêng.'],
    ['coin','KINH TẾ & NÂNG CẤP','Kiếm xu + 💎 kim cương. Tiêu ở CỬA HÀNG để nâng cấp vĩnh viễn và mua đơn vị hỗ trợ. Súng trùng sẽ lên cấp thông thạo.'],
    ['target','HỢP ĐỒNG','Trước mỗi màn chọn một HỢP ĐỒNG (rủi ro đổi phần thưởng). Chọn CHIẾN TRƯỜNG từ menu.'],
    ['alert','SỐNG SÓT','Nhặt vật phẩm (máu · khiên · bom · drone · turbo · lưỡi ủi). Thấy vòng đỏ PHÁO KÍCH thì chạy khỏi nó trước khi đạn rơi!'],
    ['tank','MỐI ĐE DOẠ', (m?'Lái':'Chạy')+' đè lên bộ binh để cán nát. Rocket RPG & ATGM BẮN HẠ ĐƯỢC. Diệt CÔNG BINH trước — chúng sửa xe. FLAK xé nát trực thăng.'],
    ['shield','TRANG BỊ','Trên vòng KỸ NĂNG: KHÓI phá khoá tên lửa · APS bắn hạ rocket bay tới · MÌN chặn xe đuổi theo · GỌI TỔ BỘ BINH đưa APC chở lính tới.'],
    ['team','LÍNH CỦA BẠN', (m?'Chạm LÍNH':'Bấm nhanh G')+' → lính nhảy xuống, tự do tác chiến trong vòng tầm bắn của xe (tự săn địch, tự rút khi lạc xa). '+(m?'Giữ LÍNH':'Giữ G')+' → gom lính về xe, nhả ra là dừng (ai chưa kịp về thì ở lại). Lính trên xe được hồi máu dần.'],
    ['dash','LÁI XE TĂNG','Xe tăng rất nặng: tăng tốc từ từ và trôi tiếp khi nhả ga. Kéo ngược để lùi. Lấy đà để húc đổ tường gạch, leo qua đá — húc nhau thì xe nhỏ hơn thiệt hơn.'],
    ['alert','TRẬN TƯỚNG','Tướng có 3 pha, giáp trước dày — bắn vào ĐUÔI (×1,6–2). Phá BỘ PHẬN (điểm sáng cam có thanh máu) để tắt đòn tương ứng. Dụ nó húc vào tường/đá → CHOÁNG ×2. Sau chuỗi đòn lớn nó XẢ NHIỆT ×1,6. Khi có KHIÊN: phá hết TRỤ PHÁT. Laser không xuyên tường — nấp!'],
    ['spark','VẬT PHẨM','Xe càng trâu, chỗ càng khó (tháp canh, trại lính, kho tiếp tế) càng rơi đồ xịn. Quầng sáng: xanh lá = thường · xanh dương = hiếm · tím = quý. Nhặt trùng buff thì được gia hạn.'],
  ];
  for(const [ic,h,t] of rows){ const r=document.createElement('div'); r.className='guide-row';
    r.innerHTML='<span class="g-ic"></span><div class="g-tx"><b>'+h+'</b><span>'+t+'</span></div>';
    r.querySelector('.g-ic').appendChild(iconEl(ic)); wrap.appendChild(r); }
}
export function openGuide(){ buildGuide(); hide('start'); hide('nick'); show('guide'); sfx('click'); }
export function closeGuide(){ hide('guide'); if(!PROFILE.onboarded){ PROFILE.onboarded=true; saveProfile(); } show('start'); refreshStartUI(); sfx('click'); }
tapBtn('guideBtn', openGuide); tapBtn('guideDone', closeGuide);
export let _coachT=null;
export function coach(msg){ const el=document.getElementById('coach'); if(!el) return; el.textContent=msg; el.classList.add('on'); clearTimeout(_coachT); _coachT=setTimeout(()=>el.classList.remove('on'), 3200); }
export function coachFirstRun(){
  if(PROFILE.coached) return; PROFILE.coached=true; saveProfile();
  const tips = MOBILE
    ? ['Nòng cố định đầu xe — quay mũi xe vào địch để bắn','Bảo vệ LÕI — đừng để nó sụp','Trụ qua 5 đợt → TƯỚNG ĐỊCH xuất hiện','Nhặt vật phẩm để sống sót']
    : ['WASD để lái · chuột để ngắm · giữ chuột để BẮN','CÁCH để lướt thoát hiểm','Bảo vệ LÕI — đừng để nó sụp','Trụ qua 5 đợt → TƯỚNG ĐỊCH xuất hiện'];
  tips.forEach((t,i)=> setTimeout(()=>{ if(S.mode==='playing') coach(t); }, 1500 + i*3400));
}
