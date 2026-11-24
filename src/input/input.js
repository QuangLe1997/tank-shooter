// input/input.js — INPUT: mouse aim raycast, keyboard, touch joysticks + action buttons, auto-fire
import * as THREE from 'three';
import { CAM_FEEL } from '../../config.js';
import { soldierFire, MOBILE, PROFILE, S, VIEW, _setMus, audio, camera, cycleGun, cycleSpell, fitShadow, floatText, heightAt, muted, playerRange, queueResize, saveProfile, selectGun, setIcon, setMuted, sfx, tapBtn, togglePause, tryDash, trySpell, spellNow, airMouse, crosshairMouse } from '../hub.js';

// ----------------------------- INPUT -----------------------------
addEventListener('keydown', e=>{ const k=e.key.toLowerCase(); if(S.mode==='playing' && k>='1' && k<='8' && !e.metaKey && !e.ctrlKey) selectGun(parseInt(k)-1); });   // gun slots on the number row · Z118 every other key → input/bindings.js
// desktop aim: raycast mouse → ground plane
export const raycaster = new THREE.Raycaster();
export const groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
export const ndc = new THREE.Vector2();
const _aimHit = new THREE.Vector3();
export function updateAimFromMouse(cx, cy){
  ndc.x = (cx/VIEW.w)*2 - 1; ndc.y = -(cy/VIEW.h)*2 + 1;
  raycaster.setFromCamera(ndc, camera); airMouse(cx, cy); crosshairMouse(cx, cy);   // Z313 where the cursor is, for snapping onto aircraft · Z376 and for the crosshair, followed into the world every frame (combat/crosshair.js)
  const hit = _aimHit;   // Z239 reused (mousemove fires hundreds of times a second — no garbage per event)
  groundPlane.constant=0;
  if(raycaster.ray.intersectPlane(groundPlane, hit)){
    for(let k=0;k<4;k++){ groundPlane.constant=-heightAt(hit.x,hit.z); if(!raycaster.ray.intersectPlane(groundPlane, hit)) break; }   // walk the ray onto the real (uneven) ground
    groundPlane.constant=0; S.aimPoint.copy(hit); S.pointerActive = true; }
}
addEventListener('mousemove', e=>{ if(!MOBILE && !RDRAG.down) updateAimFromMouse(e.clientX, e.clientY); });   // (CAM 1 the gun stays put while the right button is held: a drag turns the view)
addEventListener('mousedown', e=>{ if(MOBILE) return;
  if(e.button===2){ RDRAG.down=true; RDRAG.moved=false; RDRAG.x=RDRAG.sx=e.clientX; RDRAG.y=RDRAG.sy=e.clientY; RDRAG.t=performance.now()/1000; return; }   // RMB: a drag turns the view, a tap is the skill (CAM 1)
  if(e.button===0 && S.mode==='playing'){ S.firing=true; soldierFire(performance.now()/1000, playerRange()); } });  // LMB = fire now + hold to repeat
addEventListener('mouseup', e=>{ if(e.button===0) S.firing=false;
  if(e.button===2 && RDRAG.down){ RDRAG.down=false; if(RDRAG.moved){ RDRAG.moved=false; document.body.classList.remove('cam-drag'); updateAimFromMouse(e.clientX, e.clientY); } else if(performance.now()/1000-RDRAG.t<CAM_FEEL.rdrag.tap) trySpell(); } });
addEventListener('blur', ()=>{ S.firing=false; if(RDRAG.down){ RDRAG.down=false; RDRAG.moved=false; document.body.classList.remove('cam-drag'); } });
// CAM 1 RIGHT-BUTTON DRAG TURNS THE VIEW ("giữ phím chuột phải và kéo xoay trên nền để đổi góc camera xoay tự nhiên"): held and moved past
//   CAM_FEEL.rdrag.px it becomes a drag — sideways turns the view round the soldier (as the middle button does), up / down tilts the lens lower /
//   higher (CAM_FEEL.tilt); the gun holds its aim meanwhile and picks the cursor up again on release. A press let go inside rdrag.tap s that never
//   moved is still the skill (it was on the press: now on the release, a click is still a click)
export const RDRAG={ down:false, moved:false, x:0, y:0, sx:0, sy:0, t:0 };
addEventListener('mousemove', e=>{ if(!RDRAG.down || MOBILE) return;
  if(!RDRAG.moved && Math.hypot(e.clientX-RDRAG.sx, e.clientY-RDRAG.sy)>CAM_FEEL.rdrag.px){ RDRAG.moved=true; document.body.classList.add('cam-drag'); }
  if(RDRAG.moved){ yawBy(-(e.clientX-RDRAG.x)*CAM_FEEL.orbit); tiltBy((e.clientY-RDRAG.y)*CAM_FEEL.tilt.k); }
  RDRAG.x=e.clientX; RDRAG.y=e.clientY; });
addEventListener('contextmenu', e=>e.preventDefault());
// Z239 free camera on desktop: a trackpad PINCH (ctrl+wheel) or SHIFT+wheel zooms smoothly, a two-finger SIDEWAYS swipe or a MIDDLE-button
//   drag orbits the view round the tank; a plain wheel notch still changes gun. The camera springs (game/update.js) make every one glide.
let _gunWheel=0;
addEventListener('wheel', e=>{ if(S.mode!=='playing' && S.mode!=='countdown') return;
  const dx=e.deltaX, dy=e.deltaY, px=e.deltaMode===1?16:1;   // line-mode wheels (Firefox) → pixels
  if(e.ctrlKey || e.shiftKey){ if(e.cancelable) e.preventDefault(); const d=(e.shiftKey && !e.ctrlKey && !dy) ? dx : dy;   // macOS turns shift+wheel into deltaX
    setZoom(S.zoomT*Math.exp(d*px*CAM_FEEL.wheelZoom*(e.ctrlKey?4:1))); return; }
  if(Math.abs(dx)>Math.abs(dy)*1.2){ if(e.cancelable) e.preventDefault(); yawBy(dx*px*CAM_FEEL.orbit*0.5); return; }
  if(S.mode!=='playing') return; const now=performance.now(); if(now<_gunWheel) return; _gunWheel=now+(Math.abs(dy)<40 ? 160 : 60);   // a trackpad's stream of tiny deltas = one gun step, not ten
  cycleGun(dy>0?1:-1); }, {passive:false});
export const DRAG={ on:false, x:0, y:0 };
addEventListener('mousedown', e=>{ if(MOBILE || e.button!==1) return; e.preventDefault(); DRAG.on=true; DRAG.x=e.clientX; DRAG.y=e.clientY; document.body.classList.add('cam-drag'); });
addEventListener('mousemove', e=>{ if(!DRAG.on) return; yawBy(-(e.clientX-DRAG.x)*CAM_FEEL.orbit); tiltBy((e.clientY-DRAG.y)*CAM_FEEL.tilt.k); DRAG.x=e.clientX; DRAG.y=e.clientY; });   // (CAM 1 up / down tilts, as the right button does)
addEventListener('mouseup', e=>{ if(e.button===1 && DRAG.on){ DRAG.on=false; document.body.classList.remove('cam-drag'); } });
addEventListener('auxclick', e=>{ if(e.button===1) e.preventDefault(); });   // no middle-click autoscroll / paste
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
{ const nx=document.getElementById('mSpellNext'); if(nx){ const go=(ev)=>{ ev.stopPropagation(); ev.preventDefault(); cycleSpell(1); const sp=spellNow(); if(S.player) floatText(sp.vi||sp.name, '#bfe66a', S.player.pos, 15); };
  nx.addEventListener('touchstart', go, {passive:false}); nx.addEventListener('mousedown', go); } }   // Z84: phones can now switch skills (smoke · APS · mines …)
document.getElementById('mPause').addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();togglePause();},{passive:false});
// ----- mobile fire mode: MANUAL (left-thumb trigger) vs AUTO (fires when a target is straight ahead). Z104: barrel fixed to the hull. -----
export let autoFire = (()=>{ try{ return localStorage.getItem('steelsiege.auto')==='1'; }catch(e){ return false; } })();   // default MANUAL (trigger)
export function applyAutoFire(){ document.body.classList.toggle('autofire', autoFire); const b=document.getElementById('autoBtn'); if(b) b.classList.toggle('on', autoFire); }
export const autoBtnEl=document.getElementById('autoBtn');
if(autoBtnEl){ const tog=e=>{ if(e){e.preventDefault();e.stopPropagation();} autoFire=!autoFire; try{localStorage.setItem('steelsiege.auto',autoFire?'1':'0');}catch(_){} applyAutoFire(); sfx('click'); };
  autoBtnEl.addEventListener('click',tog); autoBtnEl.addEventListener('touchstart',tog,{passive:false}); }
// ----- camera controls: ZOOM (cycle near→far) + ROTATE view (45° steps); input is re-mapped so the joystick stays screen-relative -----
export const ZOOM_LEVELS=[0.34, 0.44, 0.55, 0.75, 1.0, 1.5, 2.0, 2.6, 3.3];   // Z145 + one wider strategic view · Z165 two close-up steps (over the shoulder of the tank)
const Z1=()=>ZOOM_LEVELS.indexOf(1.0);
export const ZOOM_MIN=ZOOM_LEVELS[0], ZOOM_MAX=ZOOM_LEVELS[ZOOM_LEVELS.length-1];
export function setZoom(z){ z=Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); S.zoomT=z; try{ localStorage.setItem('steelsiege.zoom', z.toFixed(3)); }catch(_){} try{ fitShadow(z); }catch(_){} const l=document.getElementById('zoomLbl'); if(l) l.textContent=(1/z).toFixed(1)+'×'; }   // Z171 the label reads as magnification: bigger = closer (1.0× = the default view)
try{ const z=parseFloat(localStorage.getItem('steelsiege.zoom')); if(z>0) S.zoomT=z; }catch(_){}
setZoom(S.zoomT); S.zoom=S.zoomT;   // Z239 the first frame starts settled
export const zoomBtnEl=document.getElementById('zoomBtn');
if(zoomBtnEl){ const cyc=e=>{ if(e){e.preventDefault();e.stopPropagation();} let i=ZOOM_LEVELS.findIndex(v=>Math.abs(v-S.zoomT)<0.06); i=(i+1)%ZOOM_LEVELS.length; setZoom(ZOOM_LEVELS[i]); sfx('click'); };
  zoomBtnEl.addEventListener('click',cyc); zoomBtnEl.addEventListener('touchstart',cyc,{passive:false}); }
export const rotBtnEl=document.getElementById('rotBtn');
if(rotBtnEl){ const rot=e=>{ if(e){e.preventDefault();e.stopPropagation();} rotStep(1); sfx('click'); };
  rotBtnEl.addEventListener('click',rot); rotBtnEl.addEventListener('touchstart',rot,{passive:false}); }
// Z110 camera from the keyboard + the AUTO camera toggle
// Z239 steps go to the next level PAST where the zoom is now (a pinch / wheel may have left it between levels); the camera glides there
export function zoomStep(dir){ const z=S.zoomT; let n; if(dir>0){ n=ZOOM_LEVELS.find(v=>v>z+0.03); if(n==null) n=ZOOM_MAX; } else if(dir<-1){ n=ZOOM_MIN; } else { n=[...ZOOM_LEVELS].reverse().find(v=>v<z-0.03); if(n==null) n=ZOOM_MIN; } setZoom(n); }
// 45° turns snap the TARGET to the nearest 45° notch so a free drag followed by [ ] lands on a clean angle
export function rotStep(dir){ const q=Math.PI/4, a=Math.round(S.camYawT/q)*q + dir*q; S.camYawT=((a % (Math.PI*2)) + Math.PI*2) % (Math.PI*2); }
export function yawBy(da){ S.camYawT=(((S.camYawT+da) % (Math.PI*2)) + Math.PI*2) % (Math.PI*2); }
// Z128 back-paddle camera: one button walks the zoom steps out and back (ping-pong), the other turns the view; a double tap resets just that one
let _zd=1;
export function zoomPing(){ let i=ZOOM_LEVELS.findIndex(v=>Math.abs(v-S.zoomT)<0.06); if(i<0) i=Z1(); let n=i+_zd; if(n<0 || n>=ZOOM_LEVELS.length){ _zd=-_zd; n=i+_zd; } setZoom(ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length-1, n))]); }
export function zoomReset(){ _zd=1; setZoom(MOBILE?1.5:1); }
export function yawReset(){ S.camYawT=0; S.camTiltT=0; }   // (CAM 1 the tilt back to the chase angle too)
export function tiltBy(da){ const T=CAM_FEEL.tilt; S.camTiltT=Math.max(T.min, Math.min(T.max, (S.camTiltT||0)+da)); }   // CAM 1 the lens higher (+) or lower, within CAM_FEEL.tilt
export function camReset(){ setZoom(MOBILE?1.5:1); S.camYawT=0; S.camTiltT=0; }
export function setCamAuto(on){ S.camAuto=!!on; try{ localStorage.setItem('steelsiege.camAuto', on?'1':'0'); }catch(_){}
  const b=document.getElementById('camAutoBtn'); if(b) b.classList.toggle('on', S.camAuto); }
try{ const v=localStorage.getItem('steelsiege.camAuto'); if(v!=null) S.camAuto = v==='1'; }catch(_){}
setCamAuto(S.camAuto);
export const camAutoBtnEl=document.getElementById('camAutoBtn');
if(camAutoBtnEl){ const tog=e=>{ if(e){e.preventDefault();e.stopPropagation();} setCamAuto(!S.camAuto); sfx('click'); };
  camAutoBtnEl.addEventListener('click',tog); camAutoBtnEl.addEventListener('touchstart',tog,{passive:false}); }
// Z118 camera / music keys moved to the binding table (input/bindings.js)
export const mFireEl=document.getElementById('mFire');
if(mFireEl){
  mFireEl.addEventListener('touchstart',e=>{ e.preventDefault(); e.stopPropagation(); S.firing=true; mFireEl.classList.add('firing');
    if(S.mode==='playing') soldierFire(performance.now()/1000, playerRange()); },{passive:false});   // tap = one shot, hold = full-auto (gun fireCd caps it)
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
// Z120 sound + fullscreen also live in the ⏸ menu (they left the phone HUD)
tapBtn('sndBtnP', e=>toggleMute(e)); tapBtn('fsBtnP', ()=>{ toggleFullscreen(); });
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
