// ui/keys.js — Z107 CONTROLS SHEET: every key / touch control in one place — from the home menu (PHÍM TẮT), the pause menu, or H / F1 / ? in battle (pauses while open).
import { KEYS_HELP, TOUCH_HELP, PAD_HELP } from '../../config.js';
import { MOBILE, PAD, S, hide, sfx, show, tapBtn, togglePause } from '../hub.js';

export const KEYS_UI = { from:null, paused:false };
export function buildKeysSheet(){
  const el=document.getElementById('keysBody'); if(!el) return; let h='';
  if(!MOBILE){ const groups=[]; for(const [k,tx,g] of KEYS_HELP){ let G=groups.find(x=>x.g===g); if(!G) groups.push(G={ g, rows:[] }); G.rows.push([k,tx]); }
    h+=groups.map(G=>'<div class="ks-grp"><div class="ks-gt">'+G.g+'</div>'+G.rows.map(([k,tx])=>'<div class="ks-row"><span class="ks-k">'+k.map(x=>x==='…'?'<i>…</i>':'<kbd>'+x+'</kbd>').join(' ')+'</span><span class="ks-t">'+tx+'</span></div>').join('')+'</div>').join(''); }
  h+='<div class="ks-grp touch'+(MOBILE?'':' sm')+'"><div class="ks-gt">'+(MOBILE?'ĐIỀU KHIỂN CẢM ỨNG':'TRÊN ĐIỆN THOẠI')+'</div>'+TOUCH_HELP.map(([k,tx])=>'<div class="ks-row"><span class="ks-k"><b>'+k+'</b></span><span class="ks-t">'+tx+'</span></div>').join('')+'</div>';
  h+='<div class="ks-grp pad"><div class="ks-gt">TAY CẦM'+(PAD.active?' · ĐÃ KẾT NỐI':'')+'</div>'+PAD_HELP.map(([k,tx])=>'<div class="ks-row"><span class="ks-k"><b>'+k+'</b></span><span class="ks-t">'+tx+'</span></div>').join('')+'</div>';   // Z117
  el.innerHTML=h; }
export function openKeys(from){ KEYS_UI.from=from||null; KEYS_UI.paused=false;
  if(S.mode==='playing'){ togglePause(); KEYS_UI.paused=true; hide('pause'); }   // in battle: pause underneath, come back straight to the fight
  if(from) hide(from); buildKeysSheet(); show('keysDlg'); sfx('click'); }
export function closeKeys(){ hide('keysDlg'); if(KEYS_UI.paused){ KEYS_UI.paused=false; if(S.mode==='paused') togglePause(); } else if(KEYS_UI.from) show(KEYS_UI.from); sfx('click'); }
export function keysOpen(){ const d=document.getElementById('keysDlg'); return !!d && !d.classList.contains('hidden'); }
tapBtn('keysBtn', ()=>openKeys('start')); tapBtn('keysBtnP', ()=>openKeys('pause')); tapBtn('keysDone', closeKeys);
addEventListener('keydown', e=>{ const k=e.key.toLowerCase(); if(k!=='h' && e.key!=='F1' && e.key!=='?') return; if(document.body.classList.contains('typing')) return;
  if(e.key==='F1') e.preventDefault(); if(keysOpen()) closeKeys(); else if(S.mode==='playing') openKeys(null); });
