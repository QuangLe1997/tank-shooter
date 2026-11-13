// ui/menus.js — title screen: greeting + CONTINUE, nickname dialog, and the shared tap helpers (tapBtn / tapEl / escapeHtml).
import { MOBILE, PROFILE, S, buildTerrainPicker, hide, openGuide, queueResize, refreshPowerChip, refreshWallet, saveProfile, sfx, show } from '../hub.js';

// ----------------------------- PROFILE UI: nickname · arsenal/loadout · continue · reset -----------------------------
export function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
export function tapBtn(id, fn){ const el=document.getElementById(id); if(!el) return;
  el.addEventListener('click', fn);
  el.addEventListener('touchstart', e=>{ e.preventDefault(); e.stopPropagation(); fn(e); }, {passive:false}); }   // touchstart preventDefault suppresses the ghost click
export function tapEl(el, fn){ if(!el) return; el.addEventListener('click', fn);
  el.addEventListener('touchstart', e=>{ e.preventDefault(); e.stopPropagation(); fn(e); }, {passive:false}); }
export function refreshStartUI(){
  try{ refreshPowerChip(); }catch(e){}   // Z107 power rating vs your next campaign level
  const hello=document.getElementById('hello');
  if(hello) hello.innerHTML = PROFILE.nickname ? ('CHỈ HUY <b>'+escapeHtml(PROFILE.nickname)+'</b>') : '';
  const cont=document.getElementById('continueBtn'), hasSave=!!(PROFILE.save && (PROFILE.save.stage>1 || (PROFILE.save.loop|0)>0));
  document.body.classList.toggle('hassave', hasSave);   // short-landscape grid: CONTINUE + PLAY share row 1 only when a save exists
  if(cont){ cont.style.display = hasSave ? 'inline-flex' : 'none'; const lp=hasSave?(PROFILE.save.loop|0):0;
    cont.textContent = hasSave ? ('CHƠI TIẾP ▶  '+(lp>0?'VÒNG+'+lp+' · ':'')+'MÀN '+PROFILE.save.stage) : 'CHƠI TIẾP ▶'; }
  const ac=document.getElementById('arsenalCount'); if(ac) ac.textContent=PROFILE.ownedGuns.length;   // show how many guns are collected
  refreshWallet(); buildTerrainPicker();
}
// ---- nickname (first launch / editable) ----
export function openNick(){ const inp=document.getElementById('nickInput'); if(inp) inp.value=PROFILE.nickname||''; hide('start'); show('nick'); setTimeout(()=>{ try{ inp&&inp.focus(); }catch(e){} }, 60); }
export function saveNick(){ const inp=document.getElementById('nickInput'); if(inp) inp.blur();   // Z103: tapBtn's touchstart preventDefault keeps focus in the field → body.typing stuck → HUD + touch controls hidden in the match
  let v=((inp&&inp.value)||'').trim().slice(0,16) || 'CHỈ HUY';
  PROFILE.nickname=v; saveProfile(); hide('nick'); if(!PROFILE.onboarded){ openGuide(); } else if(S.mode==='start'){ show('start'); } refreshStartUI(); sfx('click'); }
tapBtn('nickSave', saveNick);
{ const inp=document.getElementById('nickInput'); if(inp){ inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); inp.blur(); saveNick(); } });
    if(MOBILE){ inp.addEventListener('focus', ()=>{ document.body.classList.add('typing'); window.__syncAppSize&&window.__syncAppSize(); });     // Z97 keyboard up → compact card above it
      inp.addEventListener('blur', ()=>{ document.body.classList.remove('typing'); window.scrollTo(0,0); setTimeout(()=>{ window.__syncAppSize&&window.__syncAppSize(); queueResize(); }, 250); }); } } }
