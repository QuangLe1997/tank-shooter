// ui/settings.js — Z103 split from ui/menus.js. SETTINGS — difficulty · sound · music · quality · fullscreen.
import { DIFF_META, MOBILE, PROFILE, audio, controlScheme, hide, refreshStartUI, saveProfile, setMusicOn, setMuted, setQuality, sfx, show, tapBtn, tapEl, toggleFullscreen } from '../hub.js';

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
