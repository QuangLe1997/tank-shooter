// input/bindings.js — Z118 ONE BINDING TABLE for the keyboard and the controller: every action (drive, fire, skill, guns, squad orders,
//   camera, music, pause, key sheet) has up to 2 keys + 1 pad button, all rebindable from the key sheet (PROFILE.binds).
//   Also the shared MENU NAVIGATION (focus ring) for keyboard (arrows / Tab / Enter / Esc) and pad (D-pad / A / B / LB-RB / right stick).
import { ACTIONS } from '../../config.js';
import { PROFILE, S, assaultFort, callParadrop, camReset, closeKeys, crewPress, crewRelease, cycleGun, cycleSpell, fireGun, floatText, keysOpen, musterAll, openKeys, padCfg, playerRange, rotStep, saveProfile, selectDefaultGun, setCamAuto, sfx, toggleMusic, togglePause, tryDash, trySpell, yawReset, zoomPing, zoomReset, zoomStep } from '../hub.js';

// ---- the table: ACTIONS (config) = [id, label, group, defaultKeys[], defaultPadButton|null, hold?] ----
export const BIND = { cap:null, map:null };
function store(){ const b=PROFILE.binds||(PROFILE.binds={}); b.k=b.k||{}; b.p=b.p||{}; return b; }
export function keysFor(id){ const b=store(); if(b.k[id]) return b.k[id]; const a=ACTIONS.find(x=>x[0]===id); return a?a[3]:[]; }
export function padFor(id){ const b=store(); if(id in b.p) return b.p[id]; const a=ACTIONS.find(x=>x[0]===id); return a?a[4]:null; }
function rebuild(){ const m=new Map(); for(const a of ACTIONS) for(const k of keysFor(a[0])) if(!m.has(k)) m.set(k, a[0]); BIND.map=m; }
export function actionForKey(k){ if(!BIND.map) rebuild(); return BIND.map.get(k)||null; }
export function actionForPad(btn){ for(const a of ACTIONS) if(padFor(a[0])===btn) return a[0]; return null; }
export function heldAction(id){ for(const k of keysFor(id)) if(S.keys[k]) return true; return false; }
// assign: a key (or pad button) belongs to one action only — taking it from another swaps that one's old key in
export function bindKey(id, slot, key){ const b=store(); const cur=keysFor(id).slice(); const old=cur[slot];
  for(const a of ACTIONS){ if(a[0]===id) continue; const ks=keysFor(a[0]); const i=ks.indexOf(key); if(i>=0){ const n=ks.slice(); if(old) n[i]=old; else n.splice(i,1); b.k[a[0]]=n; } }
  cur[slot]=key; b.k[id]=cur.filter((k,i,arr)=>k && arr.indexOf(k)===i); saveProfile(); rebuild(); }
export function bindPad(id, btn){ const b=store(); const old=padFor(id); for(const a of ACTIONS) if(a[0]!==id && padFor(a[0])===btn) b.p[a[0]]=old; b.p[id]=btn; saveProfile(); }
export function clearKey(id, slot){ const b=store(); const cur=keysFor(id).slice(); cur.splice(slot,1); b.k[id]=cur; saveProfile(); rebuild(); }
export function resetBinds(){ PROFILE.binds={ k:{}, p:{} }; saveProfile(); rebuild(); }
export function keyLabel(k){ return ({ ' ':'CÁCH', arrowup:'↑', arrowdown:'↓', arrowleft:'←', arrowright:'→', escape:'ESC', enter:'ENTER', tab:'TAB', shift:'SHIFT', control:'CTRL', alt:'ALT', backspace:'⌫' })[k] || k.toUpperCase(); }
export const PAD_NAMES=['A','B','X','Y','LB','RB','LT','RT','⧉ View','☰ Menu','L3','R3','D-pad ↑','D-pad ↓','D-pad ←','D-pad →','Home','M1 (nút sau)','M2 (nút sau)','M3 (nút sau)','M4 (nút sau)'];

// ---- run an action (phase 'down' / 'up'); the same entry point for keys and pad buttons ----
const _tap={};
function dbl(id){ const t=performance.now(), d=t-(_tap[id]||0)<380; _tap[id]=d?0:t; return d; }   // second tap within 0.38 s = double tap
export function runAction(id, phase, repeat){ if(phase==='up'){ if(id==='crew') crewRelease(); if(id==='fire') S.firing=false; return; } if(repeat && id!=='zoomOut' && id!=='zoomIn') return;
  const now=performance.now()/1000;
  switch(id){
    case 'fire': if(S.mode==='playing'){ S.firing=true; fireGun(now, playerRange()); } break;
    case 'dash': tryDash(); break;  case 'skill': trySpell(); break;  case 'skillNext': cycleSpell(1); break;
    case 'crew': crewPress(); break; case 'autoFire': { const b=document.getElementById('autoBtn'); if(b) b.click(); } break;
    case 'gunDefault': selectDefaultGun(); break; case 'gunPrev': cycleGun(-1); break; case 'gunNext': cycleGun(1); break;
    case 'muster': musterAll(); break; case 'assault': assaultFort(); break; case 'para': callParadrop(); break;
    case 'zoomOut': if(S.zoom>=2.55 && !repeat) zoomStep(-9); else zoomStep(1); break;   // at the widest it wraps back in (one button can cycle)
    case 'zoomPing': if(dbl(id)){ zoomReset(); floatText('THU PHÓNG VỀ MẶC ĐỊNH','#9be04a',S.player?S.player.pos:{x:0,y:2,z:0},13); } else zoomPing(); break;
    case 'camTurn': if(dbl(id)){ yawReset(); floatText('CAMERA VỀ GÓC ĐẦU','#9be04a',S.player?S.player.pos:{x:0,y:2,z:0},13); } else rotStep(1); break;
    case 'autoAim': { const C=padCfg(); C.assist=!C.assist; saveProfile(); floatText(C.assist?'TỰ NGẮM: BẬT':'TỰ NGẮM: TẮT', C.assist?'#9be04a':'#ffcf5a', S.player?S.player.pos:{x:0,y:2,z:0}, 15); sfx('click'); } break;
    case 'zoomIn': zoomStep(-1); break; case 'rotL': rotStep(-1); break; case 'rotR': rotStep(1); break;
    case 'camAuto': setCamAuto(!S.camAuto); sfx('click'); break; case 'camReset': camReset(); break;
    case 'music': toggleMusic(); break; case 'pause': togglePause(); break;
    case 'keys': if(keysOpen()) closeKeys(); else if(S.mode==='playing') openKeys(null); break;
  } }

// ---- MENUS: one focus ring for keyboard and pad ----
const FOCUSABLE='.btn, .seg-chip, .bs-mode, .bs-op, .bs-map, .bs-lv, .brcard, .ldcard, .tcard, .shop-tab, .case, .dp-step, .guide-row, .bind-chip, #upcards > *, [data-pad]';
export function menuRoot(){ if(S.mode==='playing' && !document.body.classList.contains('shopopen')) return null; const L=[...document.querySelectorAll('.overlay:not(.hidden)')]; return L[L.length-1]||null; }
export function navItems(root){ return [...root.querySelectorAll(FOCUSABLE)].filter(el=>{ if(el.offsetParent===null) return false; const r=el.getBoundingClientRect(); return r.width>10 && r.height>10; }); }
export const NAV={ focus:null, kb:false, sig:null };
export function clearFocus(){ if(NAV.focus){ NAV.focus.classList.remove('padfocus'); NAV.focus=null; } NAV.sig=null; }
// Z126 a menu that redraws itself after a pick (settings chips, battle setup, ladder…) replaces the focused element: remember WHERE it was
//   (nearest container with an id + its index there + its text) so the ring lands on the same spot of the new copy, not on the bottom button
function focusSig(el){ const c=el.closest('[id]'); const items=c ? [...c.querySelectorAll(FOCUSABLE)].filter(e=>e.offsetParent!==null) : []; return { cid:c?c.id:'', idx:Math.max(0,items.indexOf(el)), txt:(el.textContent||'').trim().slice(0,24) }; }
function restoreFocus(root, L){ const g=NAV.sig; if(!g || !g.cid) return null; const c=document.getElementById(g.cid); if(!c || !root.contains(c)) return null;
  const items=L.filter(e=>c.contains(e)); if(!items.length) return null; return items[Math.min(g.idx, items.length-1)]; }
export function setFocus(el, quiet){ if(NAV.focus===el) return; clearFocus(); if(!el) return; NAV.focus=el; NAV.sig=focusSig(el); el.classList.add('padfocus'); try{ el.scrollIntoView({ block:'nearest', inline:'nearest' }); }catch(e){} if(!quiet) sfx('click'); }
export function ensureFocus(root){ const L=navItems(root); if(!L.length) return null; navHintFor(root); if(NAV.focus && L.includes(NAV.focus)) return L;
  const back=restoreFocus(root, L); if(back){ setFocus(back, true); return L; }
  const pri=[...root.querySelectorAll('.btn-primary')].find(el=>L.includes(el));
  const fs=PAD_FIRST[root.id], first = fs ? L.find(el=>el.matches(fs)) : null;   // Z127 land on the choices, not on the start button (a double A used to launch blind)
  setFocus(first||pri||L[0], true); return L; }
// the bottom hint changes per screen (the battle setup has a start shortcut)
const HINT_PAD={ battleSetup:'Ⓐ Chọn · LB/RB Đổi chế độ · ☰ VÀO TRẬN · Ⓑ Quay lại', loadout:'Ⓐ Chọn / bỏ súng · Ⓨ ★ đặt làm súng mặc định · Ⓑ Xong', deploy:'Ⓐ / → thêm quân · ← bớt quân · ↑↓ chọn điểm · ☰ XUẤT KÍCH · Ⓑ Quay lại' };
export const PAD_FIRST={ battleSetup:'.bs-mode.on', deploy:'.dp-step' };      // where the ring starts on a screen
export const PAD_GO={ battleSetup:'#bsGo', deploy:'#dp-go' };                  // ☰ Menu = the screen's start button (A only ever PICKS, so one A can never also launch)
let _hintDef=null, _hintRoot=null;
function navHintFor(root){ if(_hintRoot===root.id) return; _hintRoot=root.id; const h=document.querySelector('#navHint .nh-pad'); if(!h) return; if(_hintDef===null) _hintDef=h.textContent; h.textContent=HINT_PAD[root.id]||_hintDef; }
export function menuMove(root, dir){ const L=ensureFocus(root); if(!L) return;
  if((dir==='l'||dir==='r') && NAV.focus.classList.contains('dp-step')){ const b=NAV.focus.querySelectorAll('.s'); const t=b[dir==='l'?0:b.length-1]; if(t) t.click(); return; }
  // Z127 deploy: ←/→ on a −N+ row = −1 / +1
   const f=NAV.focus.getBoundingClientRect(), fx=f.left+f.width/2, fy=f.top+f.height/2; let best=null, bs=1e9;
  for(const el of L){ if(el===NAV.focus) continue; const r=el.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2, dx=x-fx, dy=y-fy;
    const main = dir==='u'?-dy : dir==='d'?dy : dir==='l'?-dx : dx, side=(dir==='u'||dir==='d') ? Math.abs(dx) : Math.abs(dy); if(main<4) continue;
    const s=main+side*2.2; if(s<bs){ bs=s; best=el; } }
  if(!best && (dir==='u'||dir==='d')){ const i=L.indexOf(NAV.focus); best=L[(i+(dir==='d'?1:-1)+L.length)%L.length]; }   // wrap at the ends of a column
  if(best) setFocus(best); }
export function menuCycle(root, step){ const L=ensureFocus(root); if(!L) return; const i=L.indexOf(NAV.focus); setFocus(L[(i+step+L.length)%L.length]); }
export function menuSelect(root){ ensureFocus(root); if(NAV.focus){ if(NAV.focus.classList.contains('dp-step')){ const b=NAV.focus.querySelectorAll('.s'); if(b.length) b[b.length-1].click(); return; } NAV.focus.click(); } }
let _mbBusy=false;   // Z139 the Escape fallback re-enters menuBack through the keydown handler — without this a screen with no 'back' button recursed until the stack blew
export function menuBack(root){ if(_mbBusy) return; _mbBusy=true; try{ const L=navItems(root); const back=L.find(el=>/QUAY LẠI|VỀ MENU|MENU CHÍNH|◀|XONG|ĐÓNG|TIẾP TỤC|ĐÃ HIỂU/i.test(el.textContent||''));
  if(back){ back.click(); return; } if(S.mode==='paused'){ togglePause(); return; } dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true })); } finally{ _mbBusy=false; } }
// LB / RB (or Q / E in menus): switch between the tabs of a screen (shop categories, battle-setup modes, settings segments)
export function menuTab(root, step){ const tabs=[...root.querySelectorAll('.shop-tab, .bs-mode')].filter(el=>el.offsetParent!==null); if(tabs.length<2) return false;
  let i=tabs.findIndex(t=>t.classList.contains('on')||t.classList.contains('active')); if(i<0) i=0; tabs[(i+step+tabs.length)%tabs.length].click(); sfx('click'); return true; }

// ---- REBIND capture (the key sheet's "change key" chips) ----
export function startCapture(kind, id, slot, done){ BIND.cap={ kind, id, slot, done, t:performance.now() }; }
export function captureActive(){ return !!BIND.cap; }
export function padCaptured(btn){ const c=BIND.cap; if(!c || c.kind!=='pad') return false; BIND.cap=null; bindPad(c.id, btn); if(c.done) c.done(); return true; }

// ---- keyboard dispatcher ----
const typing=()=>{ const a=document.activeElement; return document.body.classList.contains('typing') || (a && (a.tagName==='INPUT' || a.tagName==='TEXTAREA')); };
addEventListener('keydown', e=>{ const k=e.key.toLowerCase(); S.keys[k]=true;
  if(BIND.cap){ e.preventDefault(); const c=BIND.cap; if(c.kind==='key'){ BIND.cap=null; if(k!=='escape') bindKey(c.id, c.slot, k); if(c.done) c.done(); } else if(k==='escape'){ BIND.cap=null; if(c.done) c.done(); } return; }
  if(typing() || e.metaKey || e.ctrlKey) return;
  const root=menuRoot();
  if(root){                                                                                    // MENUS: arrows / Tab / Enter / Space / Esc
    const nav={ arrowup:'u', arrowdown:'d', arrowleft:'l', arrowright:'r' }[k];
    if(nav){ e.preventDefault(); NAV.kb=true; document.body.classList.add('kbnav'); menuMove(root, nav); return; }
    if(k==='tab'){ e.preventDefault(); NAV.kb=true; document.body.classList.add('kbnav'); menuCycle(root, e.shiftKey?-1:1); return; }
    if((k==='enter' || k===' ') && !e.repeat){ if(NAV.focus || NAV.kb){ e.preventDefault(); menuSelect(root); } return; }
    if((k==='escape' || k==='backspace') && !e.repeat){ e.preventDefault(); menuBack(root); return; }
    if(k==='q' || k==='e'){ if(menuTab(root, k==='q'?-1:1)) e.preventDefault(); return; }
    const a=actionForKey(k); if(a==='keys' && keysOpen() && !e.repeat){ closeKeys(); return; } if(a==='pause' && S.mode==='paused' && !e.repeat){ togglePause(); return; }
    return; }
  if(S.mode!=='playing') return;
  if(k>='1' && k<='8'){ return; }                                                               // gun slots stay on the number row (input.js)
  const a=actionForKey(k); if(!a) return; if(a==='dash' || a==='fire') e.preventDefault(); runAction(a, 'down', e.repeat); });
addEventListener('keyup', e=>{ const k=e.key.toLowerCase(); S.keys[k]=false; if(BIND.cap) return; const a=actionForKey(k); if(a) runAction(a, 'up'); });
addEventListener('mousedown', ()=>{ if(NAV.kb){ NAV.kb=false; document.body.classList.remove('kbnav'); clearFocus(); } }, true);   // the mouse takes over: drop the ring
addEventListener('blur', ()=>{ S.keys={}; S.firing=false; });
