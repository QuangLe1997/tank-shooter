// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import { BIOMES, DIFF_META, GUNS, LOADOUT_MAX, MOBILE, PROFILE, S, audio, biomeVi, controlScheme, hide, iconEl, queueResize, refreshWallet, saveProfile, setMusicOn, setMuted, setQuality, sfx, show, svgMarkup, toggleFullscreen, updateGunHUD } from '../hub.js';

// ----------------------------- PROFILE UI: nickname · arsenal/loadout · continue · reset -----------------------------
export function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
export function tapBtn(id, fn){ const el=document.getElementById(id); if(!el) return;
  el.addEventListener('click', fn);
  el.addEventListener('touchstart', e=>{ e.preventDefault(); e.stopPropagation(); fn(e); }, {passive:false}); }   // touchstart preventDefault suppresses the ghost click
export function tapEl(el, fn){ if(!el) return; el.addEventListener('click', fn);
  el.addEventListener('touchstart', e=>{ e.preventDefault(); e.stopPropagation(); fn(e); }, {passive:false}); }
export function refreshStartUI(){
  const hello=document.getElementById('hello');
  if(hello) hello.innerHTML = PROFILE.nickname ? ('CHỈ HUY <b>'+escapeHtml(PROFILE.nickname)+'</b>') : '';
  const cont=document.getElementById('continueBtn'), hasSave=!!(PROFILE.save && (PROFILE.save.stage>1 || (PROFILE.save.loop|0)>0));
  document.body.classList.toggle('hassave', hasSave);   // short-landscape grid: CONTINUE + PLAY share row 1 only when a save exists
  if(cont){ cont.style.display = hasSave ? 'inline-flex' : 'none'; const lp=hasSave?(PROFILE.save.loop|0):0;
    cont.textContent = hasSave ? ('CHƠI TIẾP ▶  '+(lp>0?'VÒNG+'+lp+' · ':'')+'MÀN '+PROFILE.save.stage) : 'CHƠI TIẾP ▶'; }
  const ac=document.getElementById('arsenalCount'); if(ac) ac.textContent=PROFILE.ownedGuns.length;   // show how many guns are collected
  refreshWallet(); buildTerrainPicker();
}
// terrain picker (start screen): AUTO (campaign rotation) + every battlefield; persists in PROFILE.terrain
// start-screen summary button reflects the current pick
export function buildTerrainPicker(){
  const cur=(Number.isInteger(PROFILE.terrain)&&PROFILE.terrain>=0)?PROFILE.terrain:-1;
  const name=cur<0?'TỰ ĐỘNG':biomeVi(BIOMES[cur].name), col=cur<0?0x8a8a8a:BIOMES[cur].ground;
  const nm=document.getElementById('tBtnName'), sw=document.getElementById('tBtnSw');
  if(nm) nm.textContent=name; if(sw) sw.style.background='#'+col.toString(16).padStart(6,'0');
}
// stylized perspective preview of a battlefield, drawn into a card's canvas
export function drawTerrainPreview(cv, b, isAuto){
  const w=cv.width, h=cv.height, x=cv.getContext('2d'), hex=c=>'#'+(c>>>0).toString(16).padStart(6,'0'), hz=Math.round(h*0.4);
  x.clearRect(0,0,w,h);
  let sky=x.createLinearGradient(0,0,0,hz); sky.addColorStop(0,hex(b.bg)); sky.addColorStop(1,hex(b.sky)); x.fillStyle=sky; x.fillRect(0,0,w,hz);
  const sunX=isAuto?w*0.5:w*0.64, sg=x.createRadialGradient(sunX,hz,2,sunX,hz,w*0.55); sg.addColorStop(0,hex(b.sun)); sg.addColorStop(.45,'rgba(0,0,0,0)');
  x.save(); x.globalAlpha=.55; x.fillStyle=sg; x.fillRect(0,0,w,hz+12); x.restore();
  x.fillStyle=hex(b.ground); x.fillRect(0,hz,w,h-hz);
  let gg=x.createLinearGradient(0,hz,0,h); gg.addColorStop(0,'rgba(0,0,0,.42)'); gg.addColorStop(.5,'rgba(0,0,0,.04)'); gg.addColorStop(1,'rgba(0,0,0,.26)'); x.fillStyle=gg; x.fillRect(0,hz,w,h-hz);
  x.strokeStyle=hex(b.grid); x.lineWidth=1; const cx=w/2; x.save(); x.globalAlpha=.42;   // converging perspective grid
  for(let i=-6;i<=6;i++){ x.beginPath(); x.moveTo(cx+i*7,hz); x.lineTo(cx+i*46,h); x.stroke(); }
  for(let i=1;i<=5;i++){ const t=i/5, yy=hz+(h-hz)*t*t; x.beginPath(); x.moveTo(0,yy); x.lineTo(w,yy); x.stroke(); } x.restore();
  if(!isAuto){ const deco=b.deco; for(let i=0;i<11;i++){ const t=Math.random(), persp=0.32+t, yy=hz+7+(h-hz-12)*t, px=Math.random()*w, s=(3+Math.random()*6)*persp;
    x.save(); x.translate(px,yy);
    if(deco==='grass'){ x.strokeStyle='#3f5f24'; x.lineWidth=1.4*persp; for(let k=-1;k<=1;k++){ x.beginPath(); x.moveTo(k*2*persp,0); x.lineTo(k*2*persp-1,-s*1.5); x.stroke(); } }
    else if(deco==='ice'){ x.fillStyle='rgba(198,240,255,.9)'; x.beginPath(); x.moveTo(0,-s*1.7); x.lineTo(s*.6,0); x.lineTo(-s*.6,0); x.closePath(); x.fill(); }
    else if(deco==='slag'){ x.fillStyle='#1c1814'; x.beginPath(); x.arc(0,-s*.4,s*.7,0,7); x.fill(); x.fillStyle='#ff5a1c'; x.beginPath(); x.arc(0,-s*.4,s*.22,0,7); x.fill(); }
    else { x.fillStyle=deco==='rubble'?'#5a564e':'#7a6a48'; x.beginPath(); x.moveTo(-s,0); x.lineTo(-s*.4,-s); x.lineTo(s*.5,-s*.8); x.lineTo(s,0); x.closePath(); x.fill(); }
    x.restore(); } }
  let vg=x.createRadialGradient(w/2,h/2,h*.2,w/2,h/2,w*.72); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.45)'); x.fillStyle=vg; x.fillRect(0,0,w,h);
  if(isAuto){ x.fillStyle='rgba(0,0,0,.36)'; x.fillRect(0,0,w,h);   // AUTO: rotate glyph overlay
    x.strokeStyle='#cfe6a0'; x.lineWidth=3.2; x.beginPath(); x.arc(w/2,h*.42,17,0.7,5.5); x.stroke();
    x.beginPath(); x.moveTo(w/2+15,h*.42-12); x.lineTo(w/2+21,h*.42-3); x.lineTo(w/2+10,h*.42-4); x.closePath(); x.fillStyle='#cfe6a0'; x.fill(); }
}
export function buildTerrainDialog(){
  const g=document.getElementById('terrainGallery'); if(!g) return; g.innerHTML='';
  const cur=(Number.isInteger(PROFILE.terrain)&&PROFILE.terrain>=-1)?PROFILE.terrain:-1;
  const opts=[{i:-1,name:'TỰ ĐỘNG',tag:'ĐỔI THEO MÀN',auto:true}].concat(BIOMES.map((b,i)=>({i,name:biomeVi(b.name),tag:'ĐỊA HÌNH',b})));
  for(const o of opts){
    const card=document.createElement('div'); card.className='tcard'+(o.i===cur?' on':''); card.dataset.i=o.i;
    const cv=document.createElement('canvas'); cv.width=192; cv.height=120; card.appendChild(cv);
    drawTerrainPreview(cv, o.auto?BIOMES[0]:o.b, !!o.auto);
    const nm=document.createElement('div'); nm.className='tc-name'; nm.innerHTML='<span>'+o.name+'</span><span class="tc-tag">'+o.tag+'</span>'; card.appendChild(nm);
    tapEl(card, ()=>{ PROFILE.terrain=o.i; saveProfile(); [...g.children].forEach(c=>c.classList.toggle('on', (+c.dataset.i)===o.i)); buildTerrainPicker(); sfx('click'); });
    g.appendChild(card);
  }
}
export function openTerrainDlg(){ hide('start'); buildTerrainDialog(); show('terrainDlg'); sfx('click'); }
export function closeTerrainDlg(){ hide('terrainDlg'); show('start'); buildTerrainPicker(); sfx('click'); }
// ---- nickname (first launch / editable) ----
export function openNick(){ const inp=document.getElementById('nickInput'); if(inp) inp.value=PROFILE.nickname||''; hide('start'); show('nick'); setTimeout(()=>{ try{ inp&&inp.focus(); }catch(e){} }, 60); }
export function saveNick(){ const inp=document.getElementById('nickInput'); let v=((inp&&inp.value)||'').trim().slice(0,16) || 'COMMANDER';
  PROFILE.nickname=v; saveProfile(); hide('nick'); if(!PROFILE.onboarded){ openGuide(); } else if(S.mode==='start'){ show('start'); } refreshStartUI(); sfx('click'); }
tapBtn('nickSave', saveNick);
{ const inp=document.getElementById('nickInput'); if(inp){ inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); inp.blur(); saveNick(); } });
    if(MOBILE){ inp.addEventListener('focus', ()=>{ document.body.classList.add('typing'); window.__syncAppSize&&window.__syncAppSize(); });     // Z97 keyboard up → compact card above it
      inp.addEventListener('blur', ()=>{ document.body.classList.remove('typing'); window.scrollTo(0,0); setTimeout(()=>{ window.__syncAppSize&&window.__syncAppSize(); queueResize(); }, 250); }); } } }
// ---- HOW TO PLAY: new-player field manual (auto first launch, re-openable) + first-match coach toasts ----
export function buildGuide(){
  const wrap=document.getElementById('guideBody'); if(!wrap) return; wrap.innerHTML='';
  const m=MOBILE;
  const rows=[
    ['bunker','NHIỆM VỤ','Bảo vệ LÕI qua 5 đợt tấn công rồi hạ TƯỚNG ĐỊCH. Mỗi màn là một CHIẾN DỊCH — phá MỤC TIÊU viền vàng để nhận thưởng + 💎.'],
    ['tank', m?'LÁI XE':'LÁI & NGẮM', m?'Cần trái để lái — tháp pháo tự ngắm & tự bắn kẻ địch gần nhất trong tầm.':'W tiến · S lùi · A/D quay thân xe (như xe tăng thật) · chuột ngắm tháp pháo · giữ chuột để BẮN. Đổi sang lái theo hướng màn hình trong CÀI ĐẶT.'],
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
    ? ['Cần trái để lái — tháp pháo tự bắn','Bảo vệ LÕI — đừng để nó sụp','Trụ qua 5 đợt → TƯỚNG ĐỊCH xuất hiện','Nhặt vật phẩm để sống sót']
    : ['WASD để lái · chuột để ngắm · giữ chuột để BẮN','CÁCH để lướt thoát hiểm','Bảo vệ LÕI — đừng để nó sụp','Trụ qua 5 đợt → TƯỚNG ĐỊCH xuất hiện'];
  tips.forEach((t,i)=> setTimeout(()=>{ if(S.mode==='playing') coach(t); }, 1500 + i*3400));
}
// ---- SETTINGS: difficulty · audio · quality · fullscreen ----
export function _segChip(label, on, fn, sub){ const c=document.createElement('div'); c.className='seg-chip'+(on?' on':''); c.innerHTML=label+(sub?' <small>'+sub+'</small>':''); tapEl(c, fn); return c; }
export function buildSettings(){
  const D=document.getElementById('setDiff'); if(D){ D.innerHTML=''; for(const k of ['recruit','soldier','veteran']){ const meta=DIFF_META[k];
    D.appendChild(_segChip(meta.label, PROFILE.difficulty===k, ()=>{ PROFILE.difficulty=k; saveProfile(); buildSettings(); sfx('click'); }, meta.tag)); } }
  const So=document.getElementById('setSound'); if(So){ So.innerHTML=''; So.appendChild(_segChip('BẬT',PROFILE.sound,()=>_setSnd(true))); So.appendChild(_segChip('TẮT',!PROFILE.sound,()=>_setSnd(false))); }
  const Mu=document.getElementById('setMusic'); if(Mu){ Mu.innerHTML=''; Mu.appendChild(_segChip('BẬT',PROFILE.music,()=>_setMus(true))); Mu.appendChild(_segChip('TẮT',!PROFILE.music,()=>_setMus(false))); }
  const Ct=document.getElementById('setCtrl'); if(Ct){ Ct.innerHTML=''; const cur=controlScheme();   // Z99 driving scheme
    Ct.appendChild(_segChip('XE TĂNG',cur==='tank',()=>{ PROFILE.ctrl='tank'; saveProfile(); buildSettings(); sfx('click'); }, MOBILE?'cần: lên tiến · ngang quay':'W/S tiến lùi · A/D quay'));
    Ct.appendChild(_segChip('THEO MÀN HÌNH',cur==='screen',()=>{ PROFILE.ctrl='screen'; saveProfile(); buildSettings(); sfx('click'); }, 'đẩy về đâu xe đi về đó')); }
  const Qu=document.getElementById('setQual'); if(Qu){ Qu.innerHTML=''; Qu.appendChild(_segChip('CAO',PROFILE.quality==='high',()=>_setQ('high'))); Qu.appendChild(_segChip('THẤP',PROFILE.quality==='low',()=>_setQ('low'))); }
}
export function _setSnd(on){ PROFILE.sound=on; saveProfile(); audio(); setMuted(!on); buildSettings(); }
export function _setMus(on){ PROFILE.music=on; saveProfile(); audio(); setMusicOn(on); buildSettings(); }
export function _setQ(q){ PROFILE.quality=q; saveProfile(); setQuality(q); buildSettings(); sfx('click'); }
export function openSettings(){ buildSettings(); hide('start'); show('settings'); sfx('click'); }
export function closeSettings(){ hide('settings'); show('start'); refreshStartUI(); sfx('click'); }
tapBtn('settingsBtn', openSettings); tapBtn('settingsDone', closeSettings);
{ const fs=document.getElementById('setFs'); if(fs) tapEl(fs, ()=>{ toggleFullscreen(); sfx('click'); }); }
// ---- arsenal / loadout (pick ≤5 from your collection) ----
export let _ldSel=[];
export function renderLoadout(){
  const grid=document.getElementById('ldgrid'); if(!grid) return; grid.innerHTML='';
  Object.keys(GUNS).forEach(id=>{                            // show every gun: owned = selectable, the rest = locked (collection goal)
    const g=GUNS[id], owned=PROFILE.ownedGuns.includes(id), on=_ldSel.includes(id);
    const card=document.createElement('div');
    card.className='ldcard'+(owned?'':' locked')+(on?' on':'');
    const num = on ? ('<div class="num">'+(_ldSel.indexOf(id)+1)+'</div>') : '';
    card.innerHTML = num+'<div class="pick"></div><div class="gi">'+svgMarkup(g.svg||'gun')+'</div><div class="nm">'+g.name+'</div><div class="tr">BẬC '+g.tier+'</div>';
    if(owned) tapEl(card, ()=>toggleLd(id));
    grid.appendChild(card);
  });
  const c=document.getElementById('ldcount'); if(c) c.textContent=_ldSel.length+'/'+LOADOUT_MAX;
}
export function toggleLd(id){ const i=_ldSel.indexOf(id);
  if(i>=0){ if(_ldSel.length>1) _ldSel.splice(i,1); }        // keep at least one weapon
  else { if(_ldSel.length>=LOADOUT_MAX) return; _ldSel.push(id); }
  sfx('click'); renderLoadout(); }
export let _ldFrom='start';
export function openLoadout(){ _ldFrom = (S.mode==='paused')?'pause':'start'; hide(_ldFrom); _ldSel=PROFILE.loadout.filter(k=>PROFILE.ownedGuns.includes(k)).slice(0,LOADOUT_MAX); if(!_ldSel.length)_ldSel=['rifle']; renderLoadout(); show('loadout'); sfx('click'); }
export function applyLoadoutToRun(){                                  // re-pick mid-battle: swap the active guns live (keep ammo of guns you already had)
  const p=S.player; if(!p) return;
  let want=PROFILE.loadout.slice(0,LOADOUT_MAX); if(!want.length) want=['rifle'];
  p.guns = want.map(id=>{ const ex=p.guns.find(g=>g.id===id); return ex || {id, ammo:GUNS[id].mag, rU:0, rD:0}; });
  if(p.gunIdx>=p.guns.length) p.gunIdx=0;
  updateGunHUD();
}
export function closeLoadout(){ PROFILE.loadout=_ldSel.slice(0,LOADOUT_MAX); if(!PROFILE.loadout.length)PROFILE.loadout=['rifle']; saveProfile(); hide('loadout');
  if(_ldFrom==='pause'){ applyLoadoutToRun(); if(S.mode==='paused') show('pause'); }   // changes take effect on the current run
  else if(S.mode==='start') show('start');
  refreshStartUI(); sfx('click'); }
tapBtn('arsenalBtn', openLoadout);
tapBtn('terrainBtn', openTerrainDlg); tapBtn('terrainDone', closeTerrainDlg);
tapBtn('arsenalBtnP', openLoadout);
tapBtn('ldDone', closeLoadout);
