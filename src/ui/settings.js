// ui/settings.js — Z103 split from ui/menus.js. SETTINGS — difficulty · sound · music · quality · fullscreen.
import { PAD_CFG } from '../../config.js';
import { DIFF_META, MOBILE, PAD, PROFILE, audio, controlScheme, hide, openPadWizard, padCfg, padDiagram, padMapFor, padRumble, padTest, refreshStartUI, resetPadMap, saveProfile, setMusicOn, setMuted, setQuality, sfx, show, tapBtn, tapEl, toggleFullscreen } from '../hub.js';

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
  buildPadSettings();
  const Qu=document.getElementById('setQual'); if(Qu){ Qu.innerHTML=''; Qu.appendChild(_segChip('CAO',PROFILE.quality==='high',()=>_setQ('high'))); Qu.appendChild(_segChip('THẤP',PROFILE.quality==='low',()=>_setQ('low'))); }
}
export function _setSnd(on){ PROFILE.sound=on; saveProfile(); audio(); setMuted(!on); buildSettings(); }
export function _setMus(on){ PROFILE.music=on; saveProfile(); audio(); setMusicOn(on); buildSettings(); }
export function _setQ(q){ PROFILE.quality=q; saveProfile(); setQuality(q); buildSettings(); sfx('click'); }
export function openSettings(){ buildSettings(); hide('start'); show('settings'); sfx('click'); }
export function closeSettings(){ hide('settings'); show('start'); refreshStartUI(); sfx('click'); }
tapBtn('settingsBtn', openSettings); tapBtn('settingsDone', closeSettings);
{ const fs=document.getElementById('setFs'); if(fs) tapEl(fs, ()=>{ toggleFullscreen(); sfx('click'); }); }

// Z117 controller settings (PROFILE.pad) — written into the settings sheet; the status row says which pad is connected
export function buildPadSettings(){ const Pv=document.getElementById('setPadView'); if(Pv) Pv.innerHTML=padDiagram();
  const C=padCfg(), set=(k,v)=>{ C[k]=v; saveProfile(); buildSettings(); sfx('click'); };
  const P=document.getElementById('setPad'); if(P){ P.innerHTML=''; const st=document.createElement('div'); st.className='seg-note'; const nm=x=>(x||'Tay cầm').replace(/\(.*?\)/g,'').trim().slice(0,42), g=PAD.gp, odd=!!g && g.mapping!=='standard', learned=!!padMapFor(g);
    st.textContent = PAD.active ? ('✓ '+nm(PAD.id)+(odd ? (learned ? ' · đã dò nút' : ' · bố cục lạ — bấm DÒ NÚT') : '')) : PAD.seen ? ('Thấy '+nm(PAD.seen.id)+' — bấm một nút bất kỳ để kích hoạt') : 'Chưa thấy tay cầm — cắm dây / bật 2.4G hoặc Bluetooth rồi bấm một nút bất kỳ (Safari không nhận tay cầm lạ: dùng Chrome hoặc app Mac)'; P.appendChild(st);
    P.appendChild(_segChip('THỬ RUNG', false, ()=>{ padTest(); sfx('click'); }));
    P.appendChild(_segChip('DÒ NÚT', false, ()=>{ openPadWizard(PAD.gp); })); if(learned) P.appendChild(_segChip('XOÁ DÒ', false, ()=>{ resetPadMap(PAD.gp); sfx('click'); })); }
  const V=document.getElementById('setVib'); if(V){ V.innerHTML=''; V.appendChild(_segChip('TẮT', !C.vib, ()=>set('vib',false)));
    for(const [l,k] of [['NHẸ',0.4],['VỪA',0.8],['MẠNH',1.0]]) V.appendChild(_segChip(l, C.vib && Math.abs(C.vibK-k)<0.05, ()=>{ C.vib=true; set('vibK',k); setTimeout(()=>padRumble(0.8,0.5,200,true),30); })); }
  const E=document.getElementById('setEng'); if(E){ E.innerHTML=''; E.appendChild(_segChip('BẬT', C.engine, ()=>set('engine',true))); E.appendChild(_segChip('TẮT', !C.engine, ()=>set('engine',false))); }
  const Lb=document.getElementById('setLob'); if(Lb){ Lb.innerHTML=''; Lb.appendChild(_segChip('KHOÁ ĐẦU XE', C.lob!==false, ()=>set('lob',true), 'cung 180°')); Lb.appendChild(_segChip('TỰ DO', C.lob===false, ()=>set('lob',false), 'như súng thường')); }
  const Se=document.getElementById('setSens'); if(Se){ Se.innerHTML=''; for(const [l,k] of PAD_CFG.sensSteps) Se.appendChild(_segChip(l, Math.abs((C.sens||1)-k)<0.01, ()=>set('sens',k), Math.round(k*100)+'%')); }
  const D=document.getElementById('setDead'); if(D){ D.innerHTML=''; for(const [l,k] of [['NHỎ',0.08],['VỪA',0.15],['LỚN',0.24]]) D.appendChild(_segChip(l, Math.abs(C.dead-k)<0.01, ()=>set('dead',k), Math.round(k*100)+'%')); }
  const Ph=document.getElementById('setPhone'); if(Ph){ Ph.innerHTML=''; Ph.appendChild(_segChip('BẬT', C.phone, ()=>{ set('phone',true); if(navigator.vibrate) try{ navigator.vibrate([60,40,90]); }catch(e){} })); Ph.appendChild(_segChip('TẮT', !C.phone, ()=>set('phone',false))); }
  const A=document.getElementById('setAssist'); if(A){ A.innerHTML=''; A.appendChild(_segChip('BẬT', C.assist, ()=>set('assist',true))); A.appendChild(_segChip('TẮT', !C.assist, ()=>set('assist',false))); }
  const W=document.getElementById('setSwap'); if(W){ W.innerHTML=''; W.appendChild(_segChip('KIỂU XBOX', !C.swapAB, ()=>set('swapAB',false), 'A dưới')); W.appendChild(_segChip('ĐỔI A↔B', C.swapAB, ()=>set('swapAB',true), 'kiểu Nintendo')); } }
addEventListener('padmapchange', ()=>setTimeout(buildPadSettings, 30));
addEventListener('gamepadconnected', ()=>{ const s=document.getElementById('settings'); if(s && !s.classList.contains('hidden')) setTimeout(buildPadSettings, 50); });
