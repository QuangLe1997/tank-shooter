// ui/menus.js — title screen: greeting, the hero (CHƠI NGAY / CHƠI TIẾP), nickname dialog, and the shared tap helpers (tapBtn / tapEl / escapeHtml / capVi).
import { dailyHome, buildSettings, launchGame, MOBILE, PROFILE, S, BS, biomeVi, buildTerrainPicker, campaignMax, hide, levelInfo, openBattleSetup, queueResize, saveProfile, sfx, show, TOD_LABEL } from '../hub.js';

// ----------------------------- PROFILE UI: nickname · arsenal/loadout · continue · reset -----------------------------
// XK-UI sentence case for the data written in capitals (battlefields, hours, weather): "SA MẠC" → "Sa mạc"
export function capVi(s){ s=String(s||'').toLocaleLowerCase('vi'); return s.charAt(0).toLocaleUpperCase('vi')+s.slice(1); }
export function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
export function tapBtn(id, fn){ const el=document.getElementById(id); if(!el) return;
  el.addEventListener('click', fn);
  el.addEventListener('touchstart', e=>{ e.preventDefault(); e.stopPropagation(); fn(e); }, {passive:false}); }   // touchstart preventDefault suppresses the ghost click
export function tapEl(el, fn){ if(!el) return; el.addEventListener('click', fn);
  el.addEventListener('touchstart', e=>{ e.preventDefault(); e.stopPropagation(); fn(e); }, {passive:false}); }
export function refreshStartUI(){
  const hasSave=!!(PROFILE.save && (PROFILE.save.stage>1 || (PROFILE.save.loop|0)>0));
  try{ const ps=document.getElementById('playSub'), I=levelInfo(campaignMax()); if(ps) ps.textContent='Cấp '+I.L+' · '+capVi(biomeVi(I.biome.name))+' · '+capVi(TOD_LABEL[I.tod]||'').toLocaleLowerCase('vi')+(I.boss?' · trận tướng':''); }catch(e){}   // Z152 what PLAY starts
  const hello=document.getElementById('hello');
  if(hello) hello.innerHTML = PROFILE.nickname ? ('<small>Chỉ huy</small><b>'+escapeHtml(PROFILE.nickname)+'</b>') : '';
  document.body.classList.toggle('hassave', hasSave);
  // XK-UI one hero: CHƠI TIẾP when a checkpoint exists (a new battle is then one tap away in Chọn trận), else CHƠI NGAY
  const play=document.getElementById('playBtn'), cont=document.getElementById('continueBtn');
  if(play) play.hidden = hasSave; if(cont) cont.hidden = !hasSave;
  if(hasSave){ const sv=PROFILE.save, lp=sv.loop|0, cs=document.getElementById('contSub'); let I=null; try{ I=levelInfo(lp*5+(sv.stage|0||1)); }catch(e){}
    if(cs) cs.textContent='Màn '+sv.stage+(I ? ' · '+capVi(biomeVi(I.biome.name)) : '')+(lp>0 ? ' · vòng '+(lp+1) : ''); }
  buildTerrainPicker();
  dailyHome();   // MODE 2 today's challenge and whether it is done (campaign/daily.js)
}
// ---- nickname (first launch / editable) ----
let _nickFrom='start';   // XK-UI the first launch asks from the home screen; Cài đặt → Tài khoản → Đổi mật danh comes back to Settings
export function openNick(from){ _nickFrom = from==='settings' ? 'settings' : 'start'; const inp=document.getElementById('nickInput'); if(inp) inp.value=PROFILE.nickname||''; hide('start'); show('nick'); setTimeout(()=>{ try{ inp&&inp.focus(); }catch(e){} }, 60); }
export function saveNick(){ const inp=document.getElementById('nickInput'); if(inp) inp.blur();   // Z103: tapBtn's touchstart preventDefault keeps focus in the field → body.typing stuck → HUD + touch controls hidden in the match
  let v=((inp&&inp.value)||'').trim().slice(0,16) || 'Chỉ huy';
  PROFILE.nickname=v; saveProfile(); hide('nick'); if(_nickFrom==='settings'){ _nickFrom='start'; show('settings'); buildSettings(); } else if(S.mode==='start'){ show('start'); } refreshStartUI(); sfx('click'); }
tapBtn('nickSave', saveNick);
{ const inp=document.getElementById('nickInput'); if(inp){ inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); inp.blur(); saveNick(); } });
    if(MOBILE){ inp.addEventListener('focus', ()=>{ document.body.classList.add('typing'); window.__syncAppSize&&window.__syncAppSize(); });     // Z97 keyboard up → compact card above it
      inp.addEventListener('blur', ()=>{ document.body.classList.remove('typing'); window.scrollTo(0,0); setTimeout(()=>{ window.__syncAppSize&&window.__syncAppSize(); queueResize(); }, 250); }); } } }
// the title screen's CONTINUE and CHỌN TRẬN, and the profile saved whenever the page is hidden or left (no-tanks: moved here from ui/shop.js)
//   (XK-UI XOÁ TIẾN TRÌNH lives in Cài đặt → Tài khoản now, behind a confirmation: ui/settings.js)
if(typeof window !== 'undefined'){ addEventListener('pagehide', saveProfile); addEventListener('visibilitychange', ()=>{ if(document.hidden) saveProfile(); });
  tapBtn('continueBtn', ()=>launchGame(true));
  tapBtn('terrainBtn', ()=>openBattleSetup(BS.tab||'campaign')); }   // the battlefield step of CHUẨN BỊ TRẬN, on the mode used last
