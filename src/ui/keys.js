// ui/keys.js — Z107 CONTROLS SHEET: every key / touch control in one place — from the home menu (PHÍM TẮT), the pause menu, or H / F1 / ? in battle (pauses while open).
import { ACTIONS, TOUCH_HELP } from '../../config.js';
import { MOBILE, PAD, PAD_NAMES, S, clearKey, escapeHtml, hide, keyLabel, keysFor, padFor, resetBinds, sfx, show, startCapture, tapBtn, togglePause } from '../hub.js';

export const KEYS_UI = { from:null, paused:false };
// Z118 the key sheet IS the rebind screen: every action with its 2 keys + its pad button — click / Enter / A on a chip, then press the new key
//   or button (Esc cancels); right-click a key chip to clear it. Mouse and number-row rows are fixed.
const MOUSE_ROWS=[['Chuột trái','Bắn (giữ = liên thanh)'],['Chuột phải','Dùng kỹ năng'],['Cuộn chuột','Đổi súng'],['1 … 8','Chọn súng theo ô'],['Di chuột','Ngắm (nòng theo con trỏ)']];
const PAD_FIXED=[['Cần trái','Lái xe — nghiêng nửa = nửa ga'],['Cần phải','Xoay nòng ngắm · thả ra: tự ngắm địch gần nhất'],['Trong menu','D-pad / cần trái chọn · A bấm · B quay lại · LB/RB đổi mục · cần phải cuộn'],['M1 · M2 (nút sau)','Gán trong app Flydigi Space Station, ví dụ M1 = A, M2 = B']];
let _capLbl=null;
function chip(kind, id, slot, txt, empty){ return '<span class="bind-chip'+(empty?' empty':'')+'" data-k="'+kind+'" data-id="'+id+'" data-s="'+slot+'" title="'+(kind==='key'?'Bấm để đổi phím · chuột phải để xoá':'Bấm rồi nhấn nút tay cầm mới')+'">'+txt+'</span>'; }
export function buildKeysSheet(){
  const el=document.getElementById('keysBody'); if(!el) return; let h='';
  const groups=[]; for(const a of ACTIONS){ let G=groups.find(x=>x.g===a[2]); if(!G) groups.push(G={ g:a[2], rows:[] }); G.rows.push(a); }
  h+='<div class="ks-bindbar"><span>Bấm vào ô phím / nút để đổi · chuột phải xoá phím</span><span class="bind-chip reset" id="bindReset">↺ MẶC ĐỊNH</span></div>';
  h+=groups.map(G=>'<div class="ks-grp bind"><div class="ks-gt">'+G.g+'<i>PHÍM · TAY CẦM</i></div>'+G.rows.map(a=>{ const ks=keysFor(a[0]), pb=padFor(a[0]);
      return '<div class="bind-row"><span class="ks-t">'+a[1]+'</span><span class="bind-keys">'+chip('key',a[0],0, ks[0]?keyLabel(ks[0]):'+', !ks[0])+chip('key',a[0],1, ks[1]?keyLabel(ks[1]):'+', !ks[1])+'</span>'+chip('pad',a[0],0, pb==null?'—':PAD_NAMES[pb], pb==null)+'</div>'; }).join('')+'</div>').join('');
  h+='<div class="ks-grp sm"><div class="ks-gt">CHUỘT · CỐ ĐỊNH</div>'+MOUSE_ROWS.map(([k,tx])=>'<div class="ks-row"><span class="ks-k"><b>'+k+'</b></span><span class="ks-t">'+tx+'</span></div>').join('')+'</div>';
  h+='<div class="ks-grp pad sm"><div class="ks-gt">TAY CẦM'+(PAD.active?' · ✓ '+escapeHtml((PAD.id||'').replace(/\(.*?\)/g,'').trim().slice(0,30)):' · chưa kết nối')+'</div>'+PAD_FIXED.map(([k,tx])=>'<div class="ks-row"><span class="ks-k"><b>'+k+'</b></span><span class="ks-t">'+tx+'</span></div>').join('')+'</div>';
  h+='<div class="ks-grp touch sm"><div class="ks-gt">'+(MOBILE?'ĐIỀU KHIỂN CẢM ỨNG':'TRÊN ĐIỆN THOẠI')+'</div>'+TOUCH_HELP.map(([k,tx])=>'<div class="ks-row"><span class="ks-k"><b>'+k+'</b></span><span class="ks-t">'+tx+'</span></div>').join('')+'</div>';
  el.innerHTML=h;
  el.querySelectorAll('.bind-chip[data-k]').forEach(c=>{ c.addEventListener('click', ev=>{ ev.preventDefault(); ev.stopPropagation(); const kind=c.dataset.k, id=c.dataset.id, slot=+c.dataset.s;
      if(_capLbl) _capLbl.classList.remove('cap'); c.classList.add('cap'); c.textContent = kind==='key' ? 'BẤM PHÍM…' : 'BẤM NÚT…'; _capLbl=c;
      startCapture(kind, id, slot, ()=>{ _capLbl=null; buildKeysSheet(); sfx('click'); }); });
    if(c.dataset.k==='key') c.addEventListener('contextmenu', ev=>{ ev.preventDefault(); clearKey(c.dataset.id, +c.dataset.s); buildKeysSheet(); }); });
  const r=document.getElementById('bindReset'); if(r) r.addEventListener('click', ev=>{ ev.stopPropagation(); resetBinds(); buildKeysSheet(); sfx('click'); }); }
export function openKeys(from){ KEYS_UI.from=from||null; KEYS_UI.paused=false;
  if(S.mode==='playing'){ togglePause(); KEYS_UI.paused=true; hide('pause'); }   // in battle: pause underneath, come back straight to the fight
  if(from) hide(from); buildKeysSheet(); show('keysDlg'); sfx('click'); }
export function closeKeys(){ hide('keysDlg'); if(KEYS_UI.paused){ KEYS_UI.paused=false; if(S.mode==='paused') togglePause(); } else if(KEYS_UI.from) show(KEYS_UI.from); sfx('click'); }
export function keysOpen(){ const d=document.getElementById('keysDlg'); return !!d && !d.classList.contains('hidden'); }
tapBtn('keysBtn', ()=>openKeys('start')); tapBtn('keysBtnP', ()=>openKeys('pause')); tapBtn('keysDone', closeKeys);
// Z118 H / F1 → binding table ('keys' action)
