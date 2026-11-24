// ui/settings.js — Z103 split from ui/menus.js · XK-UI SETTINGS in tabs (Trò chơi · Hình ảnh · Âm thanh · Điều khiển · Tay cầm · Camera · Tài khoản): one row per option, a plain hint under its name, Mặc định resets the open tab, Xong goes back to home or to the pause menu.
import { PAD_CFG, CLOUD_CFG, CAM_TUNE, SHAKE, SETTINGS_DEF } from '../../config.js';
import { CLOUDSAVE, MOBILE, PAD, PROFILE, S, audio, camParams, controlScheme, hide, linkGoogle, onCloud, openPadWizard, padCfg, padDiagram, padMapFor, padRumble, padTest, refreshStartUI, resetPadMap, saveProfile, sayVoice, setMusicOn, setMuted, setQuality, sfx, show, syncNow, tapBtn, tapEl, toggleFullscreen, isFs, hudOn, setHud, applyHud, askConfirm, openKeys, openNick, escapeHtml, refreshBestLine, __set_BEST } from '../hub.js';

export const SET = { tab:'game', from:'start' };
export const SET_TABS = ['game', 'video', 'audio', 'ctrl', 'pad', 'cam', 'account'];
// one option of a segmented control: its name, an optional second line, whether it is the current one, what a tap does
export function _segChip(label, on, fn, sub){ const c=document.createElement('div'); c.className='xs-opt'+(on?' on':''); c.setAttribute('role','button'); c.setAttribute('aria-pressed', on?'true':'false');
  c.innerHTML='<span>'+label+'</span>'+(sub?'<small>'+sub+'</small>':''); tapEl(c, fn); return c; }
const box = id => { const el=document.getElementById(id); if(el) el.innerHTML=''; return el; };
const redo = () => { buildSettings(); sfx('click'); };
const onOff = (id, on, set) => { const E=box(id); if(!E) return; E.appendChild(_segChip('Bật', on, ()=>set(true))); E.appendChild(_segChip('Tắt', !on, ()=>set(false))); };
const DIFF = { recruit:['Tân binh','dễ'], soldier:['Chiến sĩ','vừa sức'], veteran:['Lão luyện','khó'] };

export function buildSettings(){
  // ---- Trò chơi ----
  { const D=box('setDiff'); if(D) for(const k of ['recruit','soldier','veteran']) D.appendChild(_segChip(DIFF[k][0], PROFILE.difficulty===k, ()=>{ PROFILE.difficulty=k; saveProfile(); redo(); }, DIFF[k][1])); }
  for(const [id, k] of [['setHudTalk','talk'], ['setHudCards','cards'], ['setHudBanners','banners']]) onOff(id, hudOn(k), on=>{ setHud(k, on); redo(); });   // Z324 what the battle HUD shows (ui/hud-prefs.js)
  // ---- Hình ảnh ----
  { const Q=box('setQual'); if(Q){ Q.appendChild(_segChip('Cao', PROFILE.quality==='high', ()=>_setQ('high'))); Q.appendChild(_segChip('Thấp', PROFILE.quality==='low', ()=>_setQ('low'), 'máy yếu')); } }
  { const F=box('setFps'), cur=PROFILE.fps==='60'||PROFILE.fps==='30' ? PROFILE.fps : 'auto';   // XK-UI game/loop.js paceMode() reads it every frame
    if(F) for(const [k, t, s] of [['auto','Tự động','khuyên dùng'], ['60','60 FPS',''], ['30','30 FPS','đỡ tốn pin']]) F.appendChild(_segChip(t, cur===k, ()=>{ PROFILE.fps=k; saveProfile(); redo(); }, s)); }
  { const Sh=box('setShake'), cur=PROFILE.shake||SHAKE.def;   // Z239 screen-shake level
    if(Sh) for(const [k, t, s] of [['off','Tắt',''], ['low','Nhẹ','mặc định'], ['mid','Vừa',''], ['high','Mạnh','']]) Sh.appendChild(_segChip(t, cur===k, ()=>{ PROFILE.shake=k; saveProfile(); redo(); }, s)); }
  onOff('setFsRow', isFs(), on=>{ if(on!==isFs()) toggleFullscreen(); sfx('click'); setTimeout(buildSettings, 300); });   // (the browser may refuse: the row shows what really happened)
  // ---- Âm thanh ----
  { const So=box('setSound'); if(So){ So.appendChild(_segChip('Tắt', !PROFILE.sound, ()=>_setSnd(false))); for(const [k,t] of [['low','Nhỏ'],['mid','Vừa'],['high','Lớn']]) So.appendChild(_segChip(t, PROFILE.sound && (PROFILE.sfxVol||'mid')===k, ()=>_setSnd(true,k))); } }   // Z151 effects level: Tắt / Nhỏ / Vừa / Lớn
  onOff('setMusic', PROFILE.music, on=>_setMus(on));
  onOff('setVoice', PROFILE.voice!==false, on=>{ PROFILE.voice=on; saveProfile(); buildSettings(); if(on) sayVoice('open', true); else sfx('click'); });   // Z161 radio voices
  onOff('setAmb', PROFILE.ambience!==false, on=>{ PROFILE.ambience=on; saveProfile(); redo(); });   // XK-UI birds, wind, sea (the audio reads PROFILE.ambience; unset = on)
  // ---- Điều khiển ----
  { const Ct=box('setCtrl'); if(Ct){ const cur=controlScheme();   // Z99 how the move keys / stick steer
    Ct.appendChild(_segChip('Theo màn hình', cur==='screen', ()=>{ PROFILE.ctrl='screen'; saveProfile(); redo(); }, 'đẩy về đâu, đi về đó'));
    Ct.appendChild(_segChip('Xoay thân', cur==='turn', ()=>{ PROFILE.ctrl='turn'; saveProfile(); redo(); }, MOBILE?'lên tiến, ngang quay':'W/S tiến lùi, A/D quay')); } }
  buildPadSettings();
  // ---- Camera (Z184 a style + the player's own fine tuning) ----
  { const Ca=box('setCam'); if(Ca){ const cur=PROFILE.camStyle||'cine', tuned=!!PROFILE.camTune, pick=v=>{ PROFILE.camStyle=v; PROFILE.camTune=null; saveProfile(); redo(); };
      Ca.appendChild(_segChip('Điện ảnh', cur==='cine'&&!tuned, ()=>pick('cine'), 'thấp, thấy xa')); Ca.appendChild(_segChip('Chiến thuật', cur==='tactical'&&!tuned, ()=>pick('tactical'), 'cao, toàn cảnh'));
      if(tuned) Ca.appendChild(_segChip('Tuỳ chỉnh', true, ()=>{}, 'chạm một kiểu để đặt lại')); }
    const P=camParams(), T=CAM_TUNE, tune=(k,v,lim)=>{ const t=PROFILE.camTune||(PROFILE.camTune={}); t[k]=Math.round(Math.max(lim[0], Math.min(lim[1], v))*100)/100; saveProfile(); redo(); };
    const stepRow=(id, val, lim, k, fmt)=>{ const el=box(id); if(!el) return; el.classList.add('xs-step');
      el.appendChild(_segChip('−', false, ()=>tune(k, val-lim[2], lim))); el.lastChild.setAttribute('aria-label', 'Giảm');
      const v=document.createElement('div'); v.className='xs-val'; v.textContent=fmt(val); el.appendChild(v);
      el.appendChild(_segChip('+', false, ()=>tune(k, val+lim[2], lim))); el.lastChild.setAttribute('aria-label', 'Tăng'); };
    const t=PROFILE.camTune||{};
    stepRow('setCamPitch', Math.round(P.pitch), T.pitch, 'pitch', v=>Math.round(v)+'°');
    stepRow('setCamDist', t.distK!=null?t.distK:1, T.distK, 'distK', v=>Math.round(P.d0*v)+' m');
    stepRow('setCamFov', Math.round(P.fov), T.fov, 'fov', v=>Math.round(v)+'°');
    stepRow('setCamAhead', t.aheadK!=null?t.aheadK:1, T.aheadK, 'aheadK', v=>Math.round(P.ahead0*v)+' m'); }
  // ---- Tài khoản ----
  buildCloudRow();
  { const n=document.getElementById('setNickNow'); if(n) n.innerHTML = PROFILE.nickname ? 'Đang dùng <b>'+escapeHtml(PROFILE.nickname)+'</b> — tên này hiện trên bảng xếp hạng.' : 'Tên hiện trên bảng xếp hạng.'; }
  { const r=document.getElementById('setReset'); if(r) r.hidden = SET.tab==='account'; }   // nothing to reset there
}
export function _setSnd(on, lv){ PROFILE.sound=on; if(lv) PROFILE.sfxVol=lv; saveProfile(); audio(); setMuted(!on); buildSettings(); if(on) sfx('explode'); }   // Z151 a sample blast so you hear the level you picked
export function _setMus(on){ PROFILE.music=on; saveProfile(); audio(); setMusicOn(on); buildSettings(); }
export function _setQ(q){ PROFILE.quality=q; saveProfile(); setQuality(q); buildSettings(); sfx('click'); }

// ---- the tabs: one pane at a time, so no option needs a long scroll ----
export function setTab(t){ SET.tab = SET_TABS.includes(t) ? t : 'game';
  document.querySelectorAll('#setTabs .xk-tab').forEach(el=>{ const on=el.dataset.tab===SET.tab; el.classList.toggle('on', on); el.setAttribute('aria-selected', on?'true':'false'); });
  document.querySelectorAll('#setBody .xs-pane').forEach(el=>el.classList.toggle('on', el.dataset.pane===SET.tab));
  const b=document.getElementById('setBody'); if(b) b.scrollTop=0;
  buildSettings(); }
// "Mặc định": the open tab goes back to how the game ships (the pad's defaults are PAD_CFG.def; its learned button maps stay)
export function resetTab(){ const D=SETTINGS_DEF, t=SET.tab;
  if(t==='game'){ PROFILE.difficulty=D.difficulty; PROFILE.hud=null; saveProfile(); applyHud(); }
  else if(t==='video'){ PROFILE.quality=D.quality; PROFILE.fps=D.fps; PROFILE.shake=SHAKE.def; saveProfile(); setQuality(D.quality); }
  else if(t==='audio'){ PROFILE.sound=true; PROFILE.sfxVol=D.sfxVol; PROFILE.music=true; PROFILE.voice=true; PROFILE.ambience=true; saveProfile(); audio(); setMuted(false); setMusicOn(true); }
  else if(t==='ctrl'){ PROFILE.ctrl=D.ctrl; padCfg().phone=PAD_CFG.def.phone; saveProfile(); }
  else if(t==='pad'){ const C=padCfg(); for(const k in PAD_CFG.def) C[k]=PAD_CFG.def[k]; saveProfile(); }
  else if(t==='cam'){ PROFILE.camStyle=D.camStyle; PROFILE.camTune=null; saveProfile(); }
  else return;
  buildSettings(); sfx('click'); }
// from = 'start' (the home screen) or 'pause' (the pause menu); Xong / Quay lại / Esc go back there
export function openSettings(from, tab){ SET.from = from==='pause' || (from!=='start' && S.mode==='paused') ? 'pause' : 'start';
  hide(SET.from); setTab(tab || SET.tab); show('settings'); sfx('click'); }
export function closeSettings(){ hide('settings'); if(SET.from==='pause' && S.mode==='paused') show('pause'); else { show('start'); refreshStartUI(); } sfx('click'); }
tapBtn('settingsBtn', ()=>openSettings('start')); tapBtn('settingsBtnP', ()=>openSettings('pause'));
tapBtn('settingsDone', closeSettings); tapBtn('settingsBack', closeSettings); tapBtn('setReset', resetTab);
document.querySelectorAll('#setTabs .xk-tab').forEach(el=>tapEl(el, ()=>{ sfx('click'); setTab(el.dataset.tab); }));
tapBtn('setKeys', ()=>{ hide('settings'); openKeys('settings'); });
tapBtn('setNick', ()=>{ hide('settings'); openNick('settings'); });
// the progress wipe moved here from the home screen (it used to sit between the menu buttons): it asks first, in words
tapBtn('resetBtn', ()=>askConfirm({ title:'Xoá tiến trình?', body:'Kỷ lục và điểm lưu Chơi tiếp sẽ mất, không lấy lại được. Cấp đã mở, mật danh và cài đặt giữ nguyên.', yes:'Xoá tiến trình', no:'Giữ lại', danger:true }, wipeProgress));
export function wipeProgress(){ PROFILE.save=null; PROFILE.best={ score:0, stage:1 }; __set_BEST(PROFILE.best); saveProfile(); refreshBestLine(); refreshStartUI(); buildSettings();
  const r=document.getElementById('resetBtn'); if(r){ r.innerHTML='<span>Đã xoá</span>'; setTimeout(()=>{ r.innerHTML='Xoá tiến trình…'; }, 1600); } }
if(typeof document !== 'undefined') document.addEventListener('fullscreenchange', ()=>{ const s=document.getElementById('settings'); if(s && !s.classList.contains('hidden')) buildSettings(); });

// Z117 controller settings (PROFILE.pad) — the status line says which pad is connected
export function buildPadSettings(){ const Pv=document.getElementById('setPadView'); if(Pv) Pv.innerHTML=padDiagram();
  const C=padCfg(), set=(k,v)=>{ C[k]=v; saveProfile(); redo(); };
  { const st=document.getElementById('setPadSt'), nm=x=>(x||'Tay cầm').replace(/\(.*?\)/g,'').trim().slice(0,42), g=PAD.gp, odd=!!g && g.mapping!=='standard', learned=!!padMapFor(g);
    if(st) st.textContent = PAD.active ? ('Đã kết nối: '+nm(PAD.id)+(odd ? (learned ? ' — đã dò nút.' : ' — bố cục lạ, bấm Dò nút.') : '.')) : PAD.seen ? ('Thấy '+nm(PAD.seen.id)+' — bấm một nút bất kỳ để dùng.') : 'Chưa thấy tay cầm. Cắm dây hoặc bật Bluetooth rồi bấm một nút bất kỳ. Safari không nhận tay cầm lạ — dùng Chrome.';
    const P=box('setPad'); if(P){ P.appendChild(_segChip('Thử rung', false, ()=>{ padTest(); sfx('click'); })); P.appendChild(_segChip('Dò nút', false, ()=>{ openPadWizard(PAD.gp); }));
      if(learned) P.appendChild(_segChip('Xoá dò', false, ()=>{ resetPadMap(PAD.gp); sfx('click'); })); } }
  { const V=box('setVib'); if(V){ V.appendChild(_segChip('Tắt', !C.vib, ()=>set('vib',false)));
      for(const [l,k] of [['Nhẹ',0.4],['Vừa',0.8],['Mạnh',1.0]]) V.appendChild(_segChip(l, C.vib && Math.abs(C.vibK-k)<0.05, ()=>{ C.vib=true; set('vibK',k); setTimeout(()=>padRumble(0.8,0.5,200,true),30); })); } }
  { const Lb=box('setLob'); if(Lb){ Lb.appendChild(_segChip('Trước mặt', C.lob!==false, ()=>set('lob',true), 'cung 180°')); Lb.appendChild(_segChip('Tự do', C.lob===false, ()=>set('lob',false), 'như súng thường')); } }
  { const Se=box('setSens'); if(Se) for(const [l,k] of PAD_CFG.sensSteps) Se.appendChild(_segChip(l.charAt(0)+l.slice(1).toLocaleLowerCase('vi'), Math.abs((C.sens||1)-k)<0.01, ()=>set('sens',k), Math.round(k*100)+'%')); }
  { const D=box('setDead'); if(D) for(const [l,k] of [['Nhỏ',0.08],['Vừa',0.15],['Lớn',0.24]]) D.appendChild(_segChip(l, Math.abs(C.dead-k)<0.01, ()=>set('dead',k), Math.round(k*100)+'%')); }
  { const Ph=box('setPhone'); if(Ph){ Ph.appendChild(_segChip('Bật', C.phone, ()=>{ set('phone',true); if(navigator.vibrate) try{ navigator.vibrate([60,40,90]); }catch(e){} })); Ph.appendChild(_segChip('Tắt', !C.phone, ()=>set('phone',false))); } }
  { const A=box('setAssist'); if(A){ A.appendChild(_segChip('Bật', C.assist, ()=>set('assist',true))); A.appendChild(_segChip('Tắt', !C.assist, ()=>set('assist',false))); } }
  { const W=box('setSwap'); if(W){ W.appendChild(_segChip('Kiểu Xbox', !C.swapAB, ()=>set('swapAB',false), 'A ở dưới')); W.appendChild(_segChip('Đổi A↔B', C.swapAB, ()=>set('swapAB',true), 'kiểu Nintendo')); } } }
addEventListener('padmapchange', ()=>setTimeout(buildPadSettings, 30));
addEventListener('gamepadconnected', ()=>{ const s=document.getElementById('settings'); if(s && !s.classList.contains('hidden')) setTimeout(buildPadSettings, 50); });

// Z162 TÀI KHOẢN: where the save lives + sync now / link Google (Google only on the web build once the provider is on)
export function cloudStatusText(C){ const ago=C.lastSync ? Math.max(0, Math.round((Date.now()-C.lastSync)/60000)) : null;
  return C.state==='ready' ? (C.anon ? 'Khách — ' : (C.email||'Google')+' — ')+'đã lưu lên đám mây'+(ago!=null?(ago<1?', vừa xong.':', '+ago+' phút trước.'):'.')
    : C.state==='syncing'||C.state==='connecting' ? 'Đang đồng bộ…' : C.state==='offline' ? 'Ngoại tuyến — đang lưu trên máy.' : C.state==='error' ? 'Lỗi đồng bộ — đang lưu trên máy.' : 'Lưu trên máy.'; }
export function buildCloudRow(){ const st=document.getElementById('setCloudSt'), C=CLOUDSAVE; if(st){ st.textContent=cloudStatusText(C); st.title=C.err||''; }
  const el=box('setCloud'); if(!el) return;
  el.appendChild(_segChip('Đồng bộ ngay', false, ()=>{ sfx('click'); syncNow(); }));
  if(CLOUD_CFG.google && C.anon && C.state==='ready' && !/^app:/.test(location.protocol)) el.appendChild(_segChip('Liên kết Google', false, ()=>{ sfx('click'); linkGoogle(); })); }
onCloud(()=>buildCloudRow());
