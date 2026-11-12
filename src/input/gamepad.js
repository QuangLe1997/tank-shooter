// input/gamepad.js — Z117/Z118 GAMEPAD + HAPTICS. Plays the whole game from a controller through the Gamepad API ("standard" mapping by
//   button POSITION — Xbox-layout pads such as the Flydigi Direwolf 4 in XInput or Switch mode, Xbox, DualSense, Switch Pro…).
//   · battle: left stick drives, right stick lays the gun (auto-aims the nearest foe when you let go); buttons follow the binding table
//     (input/bindings.js, rebindable) — RT fire, LT skill, A dash, B crew, X skill, Y auto-fire, LB/RB guns, D-pad orders, L3/R3 camera…
//   · menus: D-pad / left stick move the focus ring, A press, B back, LB/RB switch tabs, right stick scrolls
//   · HAPTICS (feel): rhythm patterns for the pad's two motors — every gun has its own beat, a hit shakes left↔right, rams and blasts thump,
//     the engine hums — and the same patterns drive the PHONE vibration (Android; iOS app via the Capacitor Haptics plugin when present)
import * as THREE from 'three';
import { PAD_CFG, FEEL } from '../../config.js';
import { MOBILE, NAV, PAD_GO, PAD_NAMES, PROFILE, S, WIZ, actionForPad, aimTarget, captureActive, clearFocus, ensureFocus, equippedGun, floatText, menuBack, menuMove, menuRoot, menuSelect, menuTab, openPadWizard, padCaptured, padFor, padMapFor, playerRange, runAction, saveProfile, virtualPad, wizPoll } from '../hub.js';

export const PAD = { gunCombo:false, fireHeld:false, lobR:0, lobO:0, lobOn:false, fx:0, fy:0, viewCombo:false, hudSig:'', active:false, id:'', idx:-1, gp:null, lx:0, ly:0, rx:0, ry:0, lt:0, rt:0, prev:[], aimIdle:9, lastAt:0, rumbleUntil:0, rumbleLv:0, engAt:0, shake0:0, navAt:0, navDir:'' };
export function padCfg(){ const D=PAD_CFG.def; const p=PROFILE.pad||(PROFILE.pad={}); for(const k in D) if(p[k]===undefined) p[k]=D[k];
  if(!p.v130){ p.v130=1; p.engine=false; saveProfile(); }   // Z130 the engine hum (a constant buzz while driving) is OFF for everyone once; turn it back on in Cài đặt → RUNG ĐỘNG CƠ
  return p; }
// radial dead zone, rescaled so the stick still reaches 1 at the rim (no dead band felt past the edge)
function dz(x, y, d){ const m=Math.hypot(x,y); if(m<d) return [0,0]; const k=Math.min(1,(m-d)/(1-d))/m; return [x*k, y*k]; }
const _d=new THREE.Vector3(), _UP=new THREE.Vector3(0,1,0);
const BT={ A:0, B:1, X:2, Y:3, LB:4, RB:5, LT:6, RT:7, VIEW:8, MENU:9, L3:10, R3:11, UP:12, DOWN:13, LEFT:14, RIGHT:15 };

// ---- read the pad once per frame (called from game/loop.js, in menus too) ----
export function pollGamepad(dt, now){
  const pads=navigator.getGamepads ? navigator.getGamepads() : []; let gp=PAD.idx>=0 ? pads[PAD.idx] : null;
  if(!gp || !gp.connected){ gp=null; for(const g of pads) if(g && g.connected){ gp=g; PAD.idx=g.index; break; } }
  PAD.seen = gp ? { id:gp.id, mapping:gp.mapping, nb:gp.buttons.length, na:gp.axes.length } : null;   // Z123 what the browser can see, even before any input
  if(WIZ.on){ PAD.gp=gp; wizPoll(gp, now); return; }                                                     // Z123 layout wizard has the pad
  if(!gp){ if(PAD.active){ PAD.active=false; PAD.gp=null; document.body.classList.remove('pad'); } return; }
  PAD.gp=gp; const C=padCfg();
  const M=padMapFor(gp), odd=gp.mapping!=='standard', gv=M ? virtualPad(gp, M) : gp;                      // Z123 a generic HID pad reads through its learned table
  const val=i=>{ const b=gv.buttons[i]; return b ? (typeof b==='object' ? b.value : b) : 0; }, on=i=>{ const b=gv.buttons[i]; return !!b && (b.pressed || b.value>0.5); };
  const [lx,ly]=dz(gv.axes[0]||0, gv.axes[1]||0, C.dead), [rx,ry]=dz(gv.axes[2]||0, gv.axes[3]||0, C.dead);
  const lt=val(BT.LT), rt=val(BT.RT), cur=[], NB=Math.min(24, Math.max(17, gv.buttons.length)); for(let i=0;i<NB;i++) cur[i]=on(i); cur[BT.LT]=lt>0.4; cur[BT.RT]=rt>PAD_CFG.rtFire;
  if(C.swapAB){ [cur[0],cur[1]]=[cur[1],cur[0]]; [cur[2],cur[3]]=[cur[3],cur[2]]; }   // Nintendo-labelled pads
  const used = (odd && !M) ? cur.some(Boolean) : (lx||ly||rx||ry||lt>0.2||rt>0.2||cur.some(Boolean));   // an unmapped odd pad rests at junk axis values: wake on a button only
  if(used){ PAD.lastAt=now; if(!PAD.active){ PAD.active=true; PAD.id=gp.id; document.body.classList.add('pad'); floatText('TAY CẦM ĐÃ KẾT NỐI', '#9be04a', S.player?S.player.pos:{x:0,y:2,z:0}, 15); feel('connect');
      if(odd && !M && S.mode!=='playing'){ const A=PROFILE.padAsk||(PROFILE.padAsk={}); if(!A[gp.id]){ A[gp.id]=1; saveProfile(); openPadWizard(gp); PAD.prev=cur; return; } } } }   // (the waking press must not also click the wizard)   // Z123 first time a generic pad wakes: offer to learn its layout
  if(!PAD.active){ PAD.prev=cur; return; }
  { const k=1-Math.exp(-dt/PAD_CFG.aim.smooth); PAD.fx+=(rx-PAD.fx)*k; PAD.fy+=(ry-PAD.fy)*k; if(!rx && !ry && Math.hypot(PAD.fx,PAD.fy)<0.02){ PAD.fx=0; PAD.fy=0; } }   // Z124 the aim stick is lightly low-passed (no frame-to-frame jitter)
  PAD.lx=lx; PAD.ly=ly; PAD.rx=PAD.fx; PAD.ry=PAD.fy; PAD.lt=lt; PAD.rt=rt;
  const down=i=>cur[i] && !PAD.prev[i], up=i=>!cur[i] && PAD.prev[i];
  if(captureActive()){ for(let i=0;i<cur.length;i++) if(down(i)){ padCaptured(i); break; } PAD.prev=cur; return; }   // rebinding: the next button pressed
  const inMenu=document.body.classList.contains('inmenu'), root=menuRoot() || (S.mode==='playing' && inMenu ? [...document.querySelectorAll('.overlay:not(.hidden)')].pop() : null), live=S.mode==='playing' && !inMenu;   // Z128 'live' = the battle is really running (no menu on top)
  document.body.classList.toggle('padplay', live);
  if(!live && PAD.fireHeld){ S.firing=false; PAD.fireHeld=false; }                                          // a trigger held while a menu opened must not keep shooting behind it
  if(root){ navMenu(root, cur, down, lx, ly, ry, now); }
  else if(live){ clearFocus(); playInput(cur, down, up, dt, now, C); }
  else if(down(BT.A) || down(BT.MENU)) dispatchEvent(new KeyboardEvent('keydown', { key:'Enter' }));   // intro / tips: skip ahead
  // blasts and crashes: every bump of the camera shake becomes a thump (left-heavy, then a lighter tail)
  if(S.shake > PAD.shake0+0.12){ const k=Math.min(1.6, S.shake-PAD.shake0); feel('blast', k); } PAD.shake0=S.shake;
  // Z131 no engine hum — the pad only rumbles for hits, blasts and crashes
  PAD.prev=cur;
}
// Z128 HIGH-ANGLE GUNS (mortar, siege rocket): the tube is tied to the hull's FRONT half (±90°) — right stick ←/→ swings inside that arc,
//   right stick ↑/↓ lengthens / shortens the shot (barrel elevation follows the landing distance); the stick holds its value when let go
function isLobGun(){ const g=equippedGun(); return !!g && (g.special==='rocket' || g.special==='mortar'); }
function lobAim(p, dt, C){ const L=PAD_CFG.lob, sens=C.sens||1, maxR=playerRange()*L.maxMul;
  if(!PAD.lobR) PAD.lobR=Math.min(maxR, Math.max(L.min, Math.hypot(S.aimPoint.x-p.pos.x, S.aimPoint.z-p.pos.z) || playerRange()*0.7));
  const ry=Math.abs(PAD.ry)>L.dead ? PAD.ry : 0, rx=Math.abs(PAD.rx)>L.dead ? PAD.rx : 0;
  PAD.lobR=Math.max(L.min, Math.min(maxR, PAD.lobR - ry*L.speed*sens*dt));
  PAD.lobO+=(rx*L.arc-PAD.lobO)*Math.min(1, dt*L.ease);
  const a=p.facing+PAD.lobO; S.aimPoint.set(p.pos.x+Math.sin(a)*PAD.lobR, 0, p.pos.z+Math.cos(a)*PAD.lobR); S.pointerActive=true; PAD.aimIdle=0; }
let _lobTxt='';
function lobHud(on){ const el=document.getElementById('lobHud'); if(!el) return; document.body.classList.toggle('lob', on); if(!on) return;
  const t='TẦM '+Math.round(PAD.lobR||0)+' m · cần phải ↑↓ chỉnh tầm · ←→ xoay trong cung 180° trước mũi xe'; if(t!==_lobTxt){ _lobTxt=t; el.textContent=t; } }

// ---- battle: sticks are fixed (drive / aim); buttons go through the binding table ----
function playInput(cur, down, up, dt, now, C){ const p=S.player; if(!p) return;
  const am=Math.hypot(PAD.rx, PAD.ry), lobG = C.lob!==false && isLobGun();
  PAD.lobOn=lobG; lobHud(lobG); if(!lobG){ PAD.lobR=0; PAD.lobO=0; }
  if(lobG){ lobAim(p, dt, C); }
  else if(am>0.02 && am<PAD_CFG.aim.minMag){ PAD.aimIdle=0; }                                      // Z124 a barely-tilted stick holds the gun where it is (its angle is just noise)
  else if(am>=PAD_CFG.aim.minMag){ _d.set(PAD.rx, 0, PAD.ry); const m=Math.min(1,_d.length()); _d.normalize(); if(S.camYaw) _d.applyAxisAngle(_UP, S.camYaw);
    const R=playerRange()*(0.45+0.55*m); S.aimPoint.set(p.pos.x+_d.x*R, 0, p.pos.z+_d.z*R); S.pointerActive=true; PAD.aimIdle=0; }
  else { PAD.aimIdle+=dt; if(C.assist && PAD.aimIdle>PAD_CFG.assistAfter){ const t=aimTarget(playerRange());
      if(t){ S.aimPoint.set(t.pos.x, 0, t.pos.z); S.pointerActive=true; }
      else if(PAD.aimIdle>PAD_CFG.assistAfter+0.8){ S.aimPoint.set(p.pos.x+Math.sin(p.facing)*14, 0, p.pos.z+Math.cos(p.facing)*14); S.pointerActive=true; } } }   // nothing near: look where you drive
  if(down(BT.VIEW)) PAD.viewCombo=false;
  for(let i=0;i<cur.length;i++){ if(!down(i) && !up(i)) continue;
    if(cur[BT.VIEW] && CAMC[i]){ if(down(i)){ PAD.viewCombo=true; runAction(CAMC[i], 'down'); } continue; }                      // Z124 hold ⧉ View + D-pad = camera (↑ in · ↓ out · ←→ rotate)
    const a=actionForPad(i);
    if(i===BT.VIEW && a==='keys'){ if(up(i) && !PAD.viewCombo) runAction('keys', 'down'); continue; }                           // ⧉ alone opens the key sheet on release
    if((i===BT.LB || i===BT.RB) && down(i) && cur[i===BT.LB ? BT.RB : BT.LB]){ runAction('gunDefault','down'); PAD.gunCombo=true; continue; }   // Z129 LB + RB together = back to the default gun
    if(a==='fire') PAD.fireHeld=down(i);
    if(a) runAction(a, down(i)?'down':'up'); }
  padHud(now);
}
const CAMC={ 12:'zoomIn', 13:'zoomOut', 14:'rotL', 15:'rotR' };
// Z124 on-screen legend of the pad buttons that have no on-screen button (crew, orders, camera, guns) — follows the rebinding table
const HUD_IDS=[['crew','LÍNH'],['autoFire','TỰ BẮN'],['gunPrev','SÚNG−'],['gunNext','SÚNG+'],['muster','TẬP KẾT'],['assault','XUNG PHONG'],['para','LÍNH DÙ'],['autoAim','TỰ NGẮM'],['camAuto','CAM TỰ ĐỘNG'],['zoomPing','ZOOM (2× = reset)'],['camTurn','XOAY CAM (2× = reset)']];
function padHud(now){ if(now<(PAD.hudAt||0)) return; PAD.hudAt=now+0.6; const el=document.getElementById('padHud'); if(!el) return;
  const sig=HUD_IDS.map(([id])=>padFor(id)).join(','); if(sig===PAD.hudSig) return; PAD.hudSig=sig;
  el.innerHTML=HUD_IDS.filter(([id])=>padFor(id)!=null).map(([id,l])=>'<span><b>'+PAD_NAMES[padFor(id)]+'</b>'+l+'</span>').join('')+'<span><b>LB + RB</b>SÚNG MẶC ĐỊNH</span><span><b>⧉ + D-pad</b>XOAY CAM</span>'; }
// ---- menus ----
// the scrollable box the focus lives in (a list inside the overlay), else the overlay itself
function scrollPane(root){ let e=NAV.focus; while(e && e!==root){ if(e.scrollHeight>e.clientHeight+4 && /auto|scroll/.test(getComputedStyle(e).overflowY)) return e; e=e.parentElement; } return root; }
function navMenu(root, cur, down, lx, ly, ry, now){ ensureFocus(root);
  let dir=''; if(cur[BT.UP]||ly<-0.6) dir='u'; else if(cur[BT.DOWN]||ly>0.6) dir='d'; else if(cur[BT.LEFT]||lx<-0.6) dir='l'; else if(cur[BT.RIGHT]||lx>0.6) dir='r';
  if(dir && (dir!==PAD.navDir || now>PAD.navAt)){ PAD.navAt=now+(dir===PAD.navDir?PAD_CFG.navRepeat:PAD_CFG.navFirst); PAD.navDir=dir; menuMove(root, dir); } else if(!dir) PAD.navDir='';
  if(Math.abs(ry)>0.2) scrollPane(root).scrollTop += ry*14;                                       // right stick scrolls long screens (the list that holds the focus)
  if(down(BT.A)){ menuSelect(root); padRumble(0, 0.3, 50); }
  if(down(BT.B)) menuBack(root);
  if(down(BT.Y) && NAV.focus){ const st=NAV.focus.querySelector('.dflt'); if(st) st.click(); }   // Z129 arsenal: Y = make the focused gun the default
  if(down(BT.MENU) && S.mode==='paused') runAction('pause','down');
  else if(down(BT.MENU) && PAD_GO[root.id]){ const go=root.querySelector(PAD_GO[root.id]); if(go && go.offsetParent) go.click(); }   // Z127 ☰ = the screen's start button
  if(down(BT.VIEW)) runAction('keys','down');
  if(down(BT.LB)) menuTab(root, -1); if(down(BT.RB)) menuTab(root, 1);
}

// ================= HAPTICS =================
// low level: one dual-motor burst. strong = heavy low-frequency motor (left grip), weak = light high-frequency motor (right grip), 0..1
export function padRumble(strong, weak, ms, force){ const C=padCfg(); if(!C.vib || !PAD.active || !PAD.gp) return; const act=PAD.gp.vibrationActuator; if(!act || !act.playEffect) return;
  const now=performance.now(), lv=Math.max(strong, weak); if(!force && now<PAD.rumbleUntil && lv<PAD.rumbleLv*0.85) return;   // a stronger kick is still running
  PAD.rumbleUntil=now+ms; PAD.rumbleLv=lv; const k=C.vibK;
  try{ const r=act.playEffect('dual-rumble', { startDelay:0, duration:Math.round(ms), strongMagnitude:Math.min(1,strong*k), weakMagnitude:Math.min(1,weak*k) }); if(r && r.catch) r.catch(()=>{}); }catch(e){} }
// phone: Android → navigator.vibrate (on/off ms pattern); iOS app → Capacitor Haptics impact if the plugin is installed
const PH={ until:0 };
function phoneOn(){ return MOBILE && padCfg().phone; }
function phoneBuzz(pat, k, minLv){ if(!phoneOn()) return; const now=performance.now(); if(now<PH.until) return; const v=[]; let lv=0, tot=0;
  for(const [s,w,ms,gap] of pat){ const l=Math.max(s,w)*k; lv=Math.max(lv,l); v.push(l>0.12?Math.round(ms):0, Math.round(gap||0)); tot+=ms+(gap||0); }
  if(lv<(minLv||0.3)){ if(minLv>=0.45 && lv>0.18){ PH.until=now+PAD_CFG.phoneTick.gap; const H=window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics; if(H && H.impact){ try{ H.impact({ style:'LIGHT' }); }catch(e){} } else if(navigator.vibrate){ try{ navigator.vibrate(PAD_CFG.phoneTick.ms); }catch(e){} } } return; }   // Z120 light guns: a short tick, never a buzz
  PH.until=now+Math.max(90, tot);
  const H=window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
  if(H && H.impact){ try{ H.impact({ style: lv>0.75?'HEAVY':lv>0.4?'MEDIUM':'LIGHT' }); }catch(e){} return; }
  if(navigator.vibrate){ while(v.length && !v[v.length-1]) v.pop(); try{ navigator.vibrate(v.length>1?v:v[0]||30); }catch(e){} } }
// a rhythm: [[strong, weak, ms, gapAfter], …] scaled by k; side = -1 (hit from the left) / +1 (right) mirrors the motors for hit shakes
export function feelPattern(pat, k, side, phoneMin){ k=k==null?1:k; let t=0;
  for(const st of pat){ let [s,w,ms,gap]=st; if(side>0){ const x=s; s=w; w=x; } const S0=s*k, W0=w*k, M=ms; if(t===0) padRumble(S0, W0, M, true); else setTimeout(()=>padRumble(S0, W0, M, true), t); t+=ms+(gap||0); }
  phoneBuzz(pat, k, phoneMin); }
// named feels (FEEL in config). Z125: firing no longer rumbles, so a kick always means something happened TO you
export function feel(name, k, side){ const P=FEEL[name]; if(P) feelPattern(P, k, side, name==='blast'||name==='hit'||name==='impact'?0.25:0.4); }
// a hit: the pad shakes left↔right (hardest first on the side the shot came from); bigger hits shake longer
export function padHit(dmg, side){ const k=Math.min(1.2, 0.45+dmg/30); const n=dmg>=20 ? FEEL.hitHeavy : FEEL.hit; feelPattern(n, k, side||0, 0.2); }
export function padImpact(vn){ if(vn<5) return; feel('impact', Math.min(1.3, vn/18)); }
// the phone-vibration calls the game already makes (crush, ram, pickups…) also rumble the pad
export function padHaptic(ms){ if(!PAD.active) return; const total=Array.isArray(ms) ? ms.reduce((s,v,i)=>s+(i%2?0:v),0) : ms; const k=Math.min(1, total/70); padRumble(k*0.8, 0.25+k*0.6, Math.max(60, total*2.2)); }
export function padTest(){ feelPattern(FEEL.test, 1, 0, 0); }
// Z130 never leave a motor running: stop all rumble when the page is hidden / closed / loses focus, and when a pad connects
export function padRumbleStop(){ try{ const gs=navigator.getGamepads?navigator.getGamepads():[]; for(const g of gs){ const a=g && g.vibrationActuator; if(a && a.reset){ const r=a.reset(); if(r && r.catch) r.catch(()=>{}); } } }catch(e){} PAD.rumbleUntil=0; }
addEventListener('pagehide', padRumbleStop); addEventListener('blur', padRumbleStop); document.addEventListener('visibilitychange', ()=>{ if(document.hidden) padRumbleStop(); });
addEventListener('gamepadconnected', e=>{ PAD.idx=e.gamepad.index; padRumbleStop(); });
addEventListener('gamepaddisconnected', e=>{ if(e.gamepad.index===PAD.idx){ PAD.idx=-1; PAD.active=false; PAD.gp=null; document.body.classList.remove('pad'); clearFocus(); S.firing=false; } });
