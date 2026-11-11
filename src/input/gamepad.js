// input/gamepad.js — Z117/Z118 GAMEPAD + HAPTICS. Plays the whole game from a controller through the Gamepad API ("standard" mapping by
//   button POSITION — Xbox-layout pads such as the Flydigi Direwolf 4 in XInput or Switch mode, Xbox, DualSense, Switch Pro…).
//   · battle: left stick drives, right stick lays the gun (auto-aims the nearest foe when you let go); buttons follow the binding table
//     (input/bindings.js, rebindable) — RT fire, LT skill, A dash, B crew, X skill, Y auto-fire, LB/RB guns, D-pad orders, L3/R3 camera…
//   · menus: D-pad / left stick move the focus ring, A press, B back, LB/RB switch tabs, right stick scrolls
//   · HAPTICS (feel): rhythm patterns for the pad's two motors — every gun has its own beat, a hit shakes left↔right, rams and blasts thump,
//     the engine hums — and the same patterns drive the PHONE vibration (Android; iOS app via the Capacitor Haptics plugin when present)
import * as THREE from 'three';
import { PAD_CFG, GUN_FEEL, FEEL } from '../../config.js';
import { MOBILE, PROFILE, S, actionForPad, aimTarget, captureActive, clearFocus, ensureFocus, floatText, menuBack, menuMove, menuRoot, menuSelect, menuTab, padCaptured, playerRange, runAction } from '../hub.js';

export const PAD = { active:false, id:'', idx:-1, gp:null, lx:0, ly:0, rx:0, ry:0, lt:0, rt:0, prev:[], aimIdle:9, lastAt:0, rumbleUntil:0, rumbleLv:0, engAt:0, shake0:0, navAt:0, navDir:'' };
export function padCfg(){ const D=PAD_CFG.def; const p=PROFILE.pad||(PROFILE.pad={}); for(const k in D) if(p[k]===undefined) p[k]=D[k]; return p; }
// radial dead zone, rescaled so the stick still reaches 1 at the rim (no dead band felt past the edge)
function dz(x, y, d){ const m=Math.hypot(x,y); if(m<d) return [0,0]; const k=Math.min(1,(m-d)/(1-d))/m; return [x*k, y*k]; }
const _d=new THREE.Vector3(), _UP=new THREE.Vector3(0,1,0);
const BT={ A:0, B:1, X:2, Y:3, LB:4, RB:5, LT:6, RT:7, VIEW:8, MENU:9, L3:10, R3:11, UP:12, DOWN:13, LEFT:14, RIGHT:15 };

// ---- read the pad once per frame (called from game/loop.js, in menus too) ----
export function pollGamepad(dt, now){
  const pads=navigator.getGamepads ? navigator.getGamepads() : []; let gp=PAD.idx>=0 ? pads[PAD.idx] : null;
  if(!gp || !gp.connected){ gp=null; for(const g of pads) if(g && g.connected){ gp=g; PAD.idx=g.index; break; } }
  if(!gp){ if(PAD.active){ PAD.active=false; PAD.gp=null; document.body.classList.remove('pad'); } return; }
  PAD.gp=gp; const C=padCfg();
  const val=i=>{ const b=gp.buttons[i]; return b ? (typeof b==='object' ? b.value : b) : 0; }, on=i=>{ const b=gp.buttons[i]; return !!b && (b.pressed || b.value>0.5); };
  const [lx,ly]=dz(gp.axes[0]||0, gp.axes[1]||0, C.dead), [rx,ry]=dz(gp.axes[2]||0, gp.axes[3]||0, C.dead);
  const lt=val(BT.LT), rt=val(BT.RT), cur=[]; for(let i=0;i<17;i++) cur[i]=on(i); cur[BT.LT]=lt>0.4; cur[BT.RT]=rt>PAD_CFG.rtFire;
  if(C.swapAB){ [cur[0],cur[1]]=[cur[1],cur[0]]; [cur[2],cur[3]]=[cur[3],cur[2]]; }   // Nintendo-labelled pads
  const used = lx||ly||rx||ry||lt>0.2||rt>0.2||cur.some(Boolean);
  if(used){ PAD.lastAt=now; if(!PAD.active){ PAD.active=true; PAD.id=gp.id; document.body.classList.add('pad'); floatText('TAY CẦM ĐÃ KẾT NỐI', '#9be04a', S.player?S.player.pos:{x:0,y:2,z:0}, 15); feel('connect'); } }
  if(!PAD.active){ PAD.prev=cur; return; }
  PAD.lx=lx; PAD.ly=ly; PAD.rx=rx; PAD.ry=ry; PAD.lt=lt; PAD.rt=rt;
  const down=i=>cur[i] && !PAD.prev[i], up=i=>!cur[i] && PAD.prev[i];
  if(captureActive()){ for(let i=0;i<17;i++) if(down(i)){ padCaptured(i); break; } PAD.prev=cur; return; }   // rebinding: the next button pressed
  const root=menuRoot();
  if(root){ navMenu(root, cur, down, lx, ly, ry, now); }
  else if(S.mode==='playing'){ clearFocus(); playInput(cur, down, up, dt, now, C); }
  else if(down(BT.A) || down(BT.MENU)) dispatchEvent(new KeyboardEvent('keydown', { key:'Enter' }));   // intro / tips: skip ahead
  // blasts and crashes: every bump of the camera shake becomes a thump (left-heavy, then a lighter tail)
  if(S.shake > PAD.shake0+0.12){ const k=Math.min(1.6, S.shake-PAD.shake0); feel('blast', k); } PAD.shake0=S.shake;
  // the engine: a low hum in the light motor that grows with the load
  if(C.engine && S.mode==='playing' && S.player && now>PAD.engAt){ PAD.engAt=now+0.11; const th=Math.abs(S.player.throttle||0), sp=Math.min(1, Math.abs(S.player.fwdSpeed||0)/20);
    if(th>0.05 || sp>0.05) padRumble(0, PAD_CFG.engine.base+PAD_CFG.engine.load*th*(1-0.5*sp), 130); }
  PAD.prev=cur;
}
// ---- battle: sticks are fixed (drive / aim); buttons go through the binding table ----
function playInput(cur, down, up, dt, now, C){ const p=S.player; if(!p) return;
  if(PAD.rx || PAD.ry){ _d.set(PAD.rx, 0, PAD.ry); const m=Math.min(1,_d.length()); _d.normalize(); if(S.camYaw) _d.applyAxisAngle(_UP, S.camYaw);
    const R=playerRange()*(0.45+0.55*m); S.aimPoint.set(p.pos.x+_d.x*R, 0, p.pos.z+_d.z*R); S.pointerActive=true; PAD.aimIdle=0; }
  else { PAD.aimIdle+=dt; if(C.assist && PAD.aimIdle>PAD_CFG.assistAfter){ const t=aimTarget(playerRange());
      if(t){ S.aimPoint.set(t.pos.x, 0, t.pos.z); S.pointerActive=true; }
      else if(PAD.aimIdle>PAD_CFG.assistAfter+0.8){ S.aimPoint.set(p.pos.x+Math.sin(p.facing)*14, 0, p.pos.z+Math.cos(p.facing)*14); S.pointerActive=true; } } }   // nothing near: look where you drive
  for(let i=0;i<17;i++){ if(!down(i) && !up(i)) continue; const a=actionForPad(i); if(a) runAction(a, down(i)?'down':'up'); }
}
// ---- menus ----
function navMenu(root, cur, down, lx, ly, ry, now){ ensureFocus(root);
  let dir=''; if(cur[BT.UP]||ly<-0.6) dir='u'; else if(cur[BT.DOWN]||ly>0.6) dir='d'; else if(cur[BT.LEFT]||lx<-0.6) dir='l'; else if(cur[BT.RIGHT]||lx>0.6) dir='r';
  if(dir && (dir!==PAD.navDir || now>PAD.navAt)){ PAD.navAt=now+(dir===PAD.navDir?PAD_CFG.navRepeat:PAD_CFG.navFirst); PAD.navDir=dir; menuMove(root, dir); } else if(!dir) PAD.navDir='';
  if(Math.abs(ry)>0.2) root.scrollTop += ry*14;                                                  // right stick scrolls long screens
  if(down(BT.A)){ menuSelect(root); padRumble(0, 0.3, 50); }
  if(down(BT.B)) menuBack(root);
  if(down(BT.MENU) && S.mode==='paused') runAction('pause','down');
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
// named feels (FEEL in config) + per-gun shot rhythms (GUN_FEEL)
export function feel(name, k, side){ const P=FEEL[name]; if(P) feelPattern(P, k, side, name==='blast'||name==='hit'||name==='impact'?0.25:0.4); }
export function padShot(g, id){ const pat=GUN_FEEL[id] || (g.fireCd<0.1 ? GUN_FEEL._rapid : null);
  if(pat){ feelPattern(pat, 1, 0, 0.45); return; } const r=g.recoil||1; feelPattern([[Math.min(1,r*0.22), Math.min(1,0.25+r*0.14), 55+r*28]], 1, 0, 0.45); }
// a hit: the pad shakes left↔right (hardest first on the side the shot came from); bigger hits shake longer
export function padHit(dmg, side){ const k=Math.min(1.2, 0.45+dmg/30); const n=dmg>=20 ? FEEL.hitHeavy : FEEL.hit; feelPattern(n, k, side||0, 0.2); }
export function padImpact(vn){ if(vn<5) return; feel('impact', Math.min(1.3, vn/18)); }
// the phone-vibration calls the game already makes (crush, ram, pickups…) also rumble the pad
export function padHaptic(ms){ if(!PAD.active) return; const total=Array.isArray(ms) ? ms.reduce((s,v,i)=>s+(i%2?0:v),0) : ms; const k=Math.min(1, total/70); padRumble(k*0.8, 0.25+k*0.6, Math.max(60, total*2.2)); }
export function padTest(){ feelPattern(FEEL.test, 1, 0, 0); }
addEventListener('gamepadconnected', e=>{ PAD.idx=e.gamepad.index; });
addEventListener('gamepaddisconnected', e=>{ if(e.gamepad.index===PAD.idx){ PAD.idx=-1; PAD.active=false; PAD.gp=null; document.body.classList.remove('pad'); clearFocus(); S.firing=false; } });
