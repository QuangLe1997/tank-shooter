// input/input.js — INPUT: mouse aim raycast, keyboard, touch joysticks + action buttons, auto-fire
import * as THREE from 'three';
import { MOBILE, PROFILE, S, SPELLS, VIEW, _setMus, audio, camera, crewPress, crewRelease, cycleGun, cycleSpell, fireGun, floatText, heightAt, muted, playerRange, queueResize, saveProfile, selectGun, setIcon, setMuted, sfx, togglePause, tryDash, trySpell } from '../hub.js';

// ----------------------------- INPUT -----------------------------
addEventListener('keydown', e=>{
  S.keys[e.key.toLowerCase()] = true;
  if(e.key === ' ') { e.preventDefault(); tryDash(); }
  const k=e.key.toLowerCase();
  if(k === 'e') trySpell();
  if(k === 'q') cycleSpell();
  if(k === 'g' && !e.repeat) crewPress();   // Z100 tap = dismount · hold = recall the squad
  if(k>='1' && k<='8') selectGun(parseInt(k)-1);
  if(e.key === 'Escape' || k==='p') togglePause();
});
addEventListener('keyup', e=>{ S.keys[e.key.toLowerCase()] = false; if(e.key.toLowerCase()==='g') crewRelease(); });
// desktop aim: raycast mouse → ground plane
export const raycaster = new THREE.Raycaster();
export const groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
export const ndc = new THREE.Vector2();
export function updateAimFromMouse(cx, cy){
  ndc.x = (cx/VIEW.w)*2 - 1; ndc.y = -(cy/VIEW.h)*2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  groundPlane.constant=0;
  if(raycaster.ray.intersectPlane(groundPlane, hit)){
    for(let k=0;k<4;k++){ groundPlane.constant=-heightAt(hit.x,hit.z); if(!raycaster.ray.intersectPlane(groundPlane, hit)) break; }   // walk the ray onto the real (uneven) ground
    groundPlane.constant=0; S.aimPoint.copy(hit); S.pointerActive = true; }
}
addEventListener('mousemove', e=>{ if(!MOBILE) updateAimFromMouse(e.clientX, e.clientY); });
addEventListener('mousedown', e=>{ if(MOBILE) return;
  if(e.button===2){ trySpell(); return; }                                                   // RMB = spell
  if(e.button===0 && S.mode==='playing'){ S.firing=true; fireGun(performance.now()/1000, playerRange()); } });  // LMB = fire now + hold to repeat
addEventListener('mouseup', e=>{ if(e.button===0) S.firing=false; });
addEventListener('blur', ()=>{ S.firing=false; });
addEventListener('contextmenu', e=>e.preventDefault());
addEventListener('wheel', e=>{ if(S.mode==='playing') cycleGun(e.deltaY>0?1:-1); }, {passive:true});
// mobile: ONE movement joystick (dynamic origin — press anywhere on the field). The turret
// auto-aims the nearest enemy and auto-fires, so there is no aim stick and no fire button.
if(MOBILE) document.body.classList.add('touch');
export const stickL = document.getElementById('stickL');
export const move = { id:null, ox:0, oy:0, x:0, y:0 };
export const STICK_R = 58;
export function setStick(el, ox, oy, dx, dy){
  el.style.left = ox+'px'; el.style.top = oy+'px'; el.classList.add('act');
  const a = Math.atan2(dy,dx), cl = Math.min(Math.hypot(dx,dy), STICK_R);
  el.querySelector('.knob').style.transform = `translate(calc(-50% + ${Math.cos(a)*cl}px), calc(-50% + ${Math.sin(a)*cl}px))`;
}
export function clearStick(el){ el.classList.remove('act'); el.querySelector('.knob').style.transform='translate(-50%,-50%)'; }
export function onTouchStart(e){
  if(S.mode!=='playing') return;                       // only drive during gameplay (menus/cinematic ignore)
  let engaged=false;
  for(const t of e.changedTouches){
    // right side = movement joystick; left ~third is reserved for the fire trigger (left thumb)
    if(move.id===null && t.clientX > VIEW.w*0.34){ move.id=t.identifier; move.ox=t.clientX; move.oy=t.clientY; move.x=move.y=0; setStick(stickL,t.clientX,t.clientY,0,0); engaged=true; }
  }
  if(engaged && e.cancelable) e.preventDefault();
}
export function onTouchMove(e){
  if(move.id===null) return;
  for(const t of e.changedTouches){
    if(t.identifier===move.id){ move.x=t.clientX-move.ox; move.y=t.clientY-move.oy; setStick(stickL,move.ox,move.oy,move.x,move.y); }
  }
  if(e.cancelable) e.preventDefault();
}
export function onTouchEnd(e){
  for(const t of e.changedTouches){
    if(t.identifier===move.id){ move.id=null; move.x=move.y=0; clearStick(stickL); }
  }
}
// Listen on window: the #touch overlay is pointer-events:none (so its own listener never fired — that was the bug).
// Buttons inside call stopPropagation, so tapping them won't also start the joystick.
addEventListener('touchstart', onTouchStart, {passive:false});
addEventListener('touchmove', onTouchMove, {passive:false});
addEventListener('touchend', onTouchEnd);
addEventListener('touchcancel', onTouchEnd);
// mobile buttons
export const armBtn=(id,fn)=>{ const el=document.getElementById(id); if(!el) return;
  el.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();fn();},{passive:false}); };
armBtn('mDash', tryDash); armBtn('mSpell', trySpell);
armBtn('mWeapon', ()=>cycleGun(1));
{ const nx=document.getElementById('mSpellNext'); if(nx){ const go=(ev)=>{ ev.stopPropagation(); ev.preventDefault(); cycleSpell(1); const sp=SPELLS[S.spell]; if(S.player) floatText(sp.vi||sp.name, '#bfe66a', S.player.pos, 15); };
  nx.addEventListener('touchstart', go, {passive:false}); nx.addEventListener('mousedown', go); } }   // Z84: phones can now switch skills (smoke · APS · mines …)
document.getElementById('mPause').addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();togglePause();},{passive:false});
// ----- mobile fire mode: MANUAL (left-thumb trigger) vs AUTO (fires when a target is straight ahead). Z104: barrel fixed to the hull. -----
export let autoFire = (()=>{ try{ return localStorage.getItem('steelsiege.auto')==='1'; }catch(e){ return false; } })();   // default MANUAL (trigger)
export function applyAutoFire(){ document.body.classList.toggle('autofire', autoFire); const b=document.getElementById('autoBtn'); if(b) b.classList.toggle('on', autoFire); }
export const autoBtnEl=document.getElementById('autoBtn');
if(autoBtnEl){ const tog=e=>{ if(e){e.preventDefault();e.stopPropagation();} autoFire=!autoFire; try{localStorage.setItem('steelsiege.auto',autoFire?'1':'0');}catch(_){} applyAutoFire(); sfx('click'); };
  autoBtnEl.addEventListener('click',tog); autoBtnEl.addEventListener('touchstart',tog,{passive:false}); }
// ----- camera controls: ZOOM (cycle near→far) + ROTATE view (45° steps); input is re-mapped so the joystick stays screen-relative -----
export const ZOOM_LEVELS=[1.0, 1.5, 2.0, 2.6];
export function setZoom(z){ try{ S.zoom=z; localStorage.setItem('steelsiege.zoom', z); }catch(_){ S.zoom=z; } const l=document.getElementById('zoomLbl'); if(l) l.textContent=z.toFixed(1)+'×'; }
try{ const z=parseFloat(localStorage.getItem('steelsiege.zoom')); if(z>0) S.zoom=z; }catch(_){}
setZoom(S.zoom);
export const zoomBtnEl=document.getElementById('zoomBtn');
if(zoomBtnEl){ const cyc=e=>{ if(e){e.preventDefault();e.stopPropagation();} let i=ZOOM_LEVELS.findIndex(v=>Math.abs(v-S.zoom)<0.06); i=(i+1)%ZOOM_LEVELS.length; setZoom(ZOOM_LEVELS[i]); sfx('click'); };
  zoomBtnEl.addEventListener('click',cyc); zoomBtnEl.addEventListener('touchstart',cyc,{passive:false}); }
export const rotBtnEl=document.getElementById('rotBtn');
if(rotBtnEl){ const rot=e=>{ if(e){e.preventDefault();e.stopPropagation();} S.camYaw=(S.camYaw + Math.PI/4) % (Math.PI*2); sfx('click'); };
  rotBtnEl.addEventListener('click',rot); rotBtnEl.addEventListener('touchstart',rot,{passive:false}); }
// Z110 camera from the keyboard + the AUTO camera toggle
export function zoomStep(dir){ let i=ZOOM_LEVELS.findIndex(v=>Math.abs(v-S.zoom)<0.06); if(i<0) i=1; i=Math.max(0, Math.min(ZOOM_LEVELS.length-1, i+dir)); setZoom(ZOOM_LEVELS[i]); }
export function rotStep(dir){ S.camYaw=((S.camYaw + dir*Math.PI/4) % (Math.PI*2) + Math.PI*2) % (Math.PI*2); }
export function camReset(){ setZoom(MOBILE?1.5:1); S.camYaw=0; }
export function setCamAuto(on){ S.camAuto=!!on; try{ localStorage.setItem('steelsiege.camAuto', on?'1':'0'); }catch(_){}
  const b=document.getElementById('camAutoBtn'); if(b) b.classList.toggle('on', S.camAuto); }
try{ const v=localStorage.getItem('steelsiege.camAuto'); if(v!=null) S.camAuto = v==='1'; }catch(_){}
setCamAuto(S.camAuto);
export const camAutoBtnEl=document.getElementById('camAutoBtn');
if(camAutoBtnEl){ const tog=e=>{ if(e){e.preventDefault();e.stopPropagation();} setCamAuto(!S.camAuto); sfx('click'); };
  camAutoBtnEl.addEventListener('click',tog); camAutoBtnEl.addEventListener('touchstart',tog,{passive:false}); }
addEventListener('keydown', e=>{ if(document.body.classList.contains('typing') || e.metaKey || e.ctrlKey) return; const k=e.key;
  if(k==='-' || k==='_'){ zoomStep(1); }                 // farther
  else if(k==='=' || k==='+'){ zoomStep(-1); }           // closer
  else if(k==='['){ rotStep(-1); } else if(k===']'){ rotStep(1); }
  else if(k==='c' || k==='C'){ if(!e.repeat){ setCamAuto(!S.camAuto); sfx('click'); } }
  else if(k==='v' || k==='V'){ if(!e.repeat) camReset(); }
  else if(k==='m' || k==='M'){ if(!e.repeat) toggleMusic(); } });
export const mFireEl=document.getElementById('mFire');
if(mFireEl){
  mFireEl.addEventListener('touchstart',e=>{ e.preventDefault(); e.stopPropagation(); S.firing=true; mFireEl.classList.add('firing');
    if(S.mode==='playing') fireGun(performance.now()/1000, playerRange()); },{passive:false});   // tap = one shot, hold = full-auto (gun fireCd caps it)
  const rel=e=>{ if(e&&e.preventDefault)e.preventDefault(); S.firing=false; mFireEl.classList.remove('firing'); };
  mFireEl.addEventListener('touchend',rel); mFireEl.addEventListener('touchcancel',rel); }
applyAutoFire();
// mute toggle (desktop + mobile)
export const muteBtnEl=document.getElementById('muteBtn');
export const toggleMute=e=>{ if(e){e.preventDefault();e.stopPropagation();} audio(); setMuted(!muted); PROFILE.sound=!muted; saveProfile(); };
muteBtnEl.addEventListener('click', toggleMute);
muteBtnEl.addEventListener('touchstart', toggleMute, {passive:false});
// Z111 background-music toggle (sound effects stay on) — button next to the speaker + the M key; same setting as Cài đặt → Nhạc
export const musBtnEl=document.getElementById('musBtn');
export const toggleMusic=e=>{ if(e){e.preventDefault();e.stopPropagation();} _setMus(PROFILE.music===false); };
musBtnEl.addEventListener('click', toggleMusic);
musBtnEl.addEventListener('touchstart', toggleMusic, {passive:false});
export const musBtnPEl=document.getElementById('musBtnP');   // the same switch in the ⏸ menu (the phone's HUD row has no room)
musBtnPEl.addEventListener('click', toggleMusic);
musBtnPEl.addEventListener('touchstart', toggleMusic, {passive:false});
// fullscreen (immersive, like a video). iPhone Safari lacks the API → button is a graceful no-op there.
export function isFs(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); }
export function reqFs(){ const el=document.documentElement; const r=el.requestFullscreen||el.webkitRequestFullscreen;
  if(r){ try{ const p=r.call(el); if(p&&p.catch) p.catch(()=>{}); }catch(e){} }
  if(MOBILE && screen.orientation && screen.orientation.lock){ try{ const q=screen.orientation.lock('landscape'); if(q&&q.catch) q.catch(()=>{}); }catch(e){} } }
export function exitFs(){ const x=document.exitFullscreen||document.webkitExitFullscreen; if(x){ try{ x.call(document); }catch(e){} } }
export function toggleFullscreen(){ isFs()?exitFs():reqFs(); }
export function syncFsIcon(){ const b=document.querySelector('#fsBtn .ic'); if(b) setIcon(b, isFs()?'compress':'expand'); }
document.addEventListener('fullscreenchange', syncFsIcon);
document.addEventListener('webkitfullscreenchange', syncFsIcon);
export const FS_SUPPORTED = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);   // iOS Safari/Chrome have NO Fullscreen API → button would be dead
// browsers only grant fullscreen/orientation-lock inside a user gesture → take the very first one on mobile
export let _fsAsked=false;
export function fsOnFirstGesture(){ if(_fsAsked||!MOBILE) return; _fsAsked=true; reqFs(); queueResize(); setTimeout(queueResize,350); }
addEventListener('touchend', fsOnFirstGesture, {capture:true});
addEventListener('pointerdown', fsOnFirstGesture, {capture:true});
export const fsBtnEl=document.getElementById('fsBtn');
if(fsBtnEl){
  if(!FS_SUPPORTED){ fsBtnEl.style.display='none'; }   // hide on iOS instead of showing a button that does nothing
  else { fsBtnEl.addEventListener('click', e=>{ e.stopPropagation(); toggleFullscreen(); });
    fsBtnEl.addEventListener('touchstart', e=>{ e.preventDefault(); e.stopPropagation(); toggleFullscreen(); }, {passive:false}); }
}
