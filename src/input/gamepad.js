// input/gamepad.js — Z117 GAMEPAD: plays the whole game from a controller through the Gamepad API ("standard" mapping —
//   Xbox-layout pads such as the Flydigi Direwolf 4 in XInput or Switch mode, Xbox, DualShock/DualSense, Switch Pro…).
//   · battle: left stick drives, right stick lays the gun (auto-aims the nearest foe when you let go), RT fires, LT = skill…
//   · menus: D-pad / left stick moves a focus ring between buttons, A presses, B goes back
//   · rumble: dual-motor effects for every shot (by the gun's recoil), hits taken, blasts, rams, crushing, engine load
import * as THREE from 'three';
import { PAD_CFG } from '../../config.js';
import { PROFILE, S, aimTarget, assaultFort, callParadrop, camReset, closeKeys, crewPress, crewRelease, cycleGun, cycleSpell, fireGun, floatText, keysOpen, musterAll, openKeys, playerRange, setCamAuto, sfx, togglePause, tryDash, trySpell, zoomStep } from '../hub.js';

export const PAD = { active:false, id:'', idx:-1, gp:null, lx:0, ly:0, rx:0, ry:0, lt:0, rt:0, prev:[], aimIdle:9, lastAt:0, rumbleUntil:0, rumbleLv:0, engAt:0, shake0:0, focus:null, navAt:0, navDir:'' };
export function padCfg(){ const D=PAD_CFG.def; const p=PROFILE.pad||(PROFILE.pad={}); for(const k in D) if(p[k]===undefined) p[k]=D[k]; return p; }
// radial dead zone, rescaled so the stick still reaches 1 at the rim (no dead band felt past the edge)
function dz(x, y, d){ const m=Math.hypot(x,y); if(m<d) return [0,0]; const k=Math.min(1,(m-d)/(1-d))/m; return [x*k, y*k]; }
const _d=new THREE.Vector3(), _UP=new THREE.Vector3(0,1,0);
// standard-mapping button indices (by POSITION: 0 = bottom face button, whatever its label)
const BT={ A:0, B:1, X:2, Y:3, LB:4, RB:5, LT:6, RT:7, VIEW:8, MENU:9, L3:10, R3:11, UP:12, DOWN:13, LEFT:14, RIGHT:15, HOME:16 };

// ---- read the pad once per frame (called from game/loop.js, in menus too) ----
export function pollGamepad(dt, now){
  const pads=navigator.getGamepads ? navigator.getGamepads() : []; let gp=PAD.idx>=0 ? pads[PAD.idx] : null;
  if(!gp || !gp.connected){ gp=null; for(const g of pads) if(g && g.connected){ gp=g; PAD.idx=g.index; break; } }
  if(!gp){ if(PAD.active){ PAD.active=false; PAD.gp=null; document.body.classList.remove('pad'); clearFocus(); } return; }
  PAD.gp=gp; const C=padCfg();
  const val=i=>{ const b=gp.buttons[i]; return b ? (typeof b==='object' ? b.value : b) : 0; }, on=i=>{ const b=gp.buttons[i]; return !!b && (b.pressed || b.value>0.5); };
  const [lx,ly]=dz(gp.axes[0]||0, gp.axes[1]||0, C.dead), [rx,ry]=dz(gp.axes[2]||0, gp.axes[3]||0, C.dead);
  const lt=val(BT.LT), rt=val(BT.RT), cur=[]; for(let i=0;i<17;i++) cur[i]=on(i); cur[BT.LT]=lt>0.4; cur[BT.RT]=rt>PAD_CFG.rtFire;
  const used = lx||ly||rx||ry||lt>0.2||rt>0.2||cur.some(Boolean);
  if(used){ PAD.lastAt=now; if(!PAD.active){ PAD.active=true; PAD.id=gp.id; document.body.classList.add('pad'); floatText('TAY CẦM ĐÃ KẾT NỐI', '#9be04a', S.player?S.player.pos:{x:0,y:2,z:0}, 15); padRumble(0.35, 0.35, 160, true); } }
  if(!PAD.active){ PAD.prev=cur; return; }
  PAD.lx=lx; PAD.ly=ly; PAD.rx=rx; PAD.ry=ry; PAD.lt=lt; PAD.rt=rt;
  const sw=C.swapAB, A=sw?BT.B:BT.A, B=sw?BT.A:BT.B, X=sw?BT.Y:BT.X, Y=sw?BT.X:BT.Y;   // Nintendo-labelled pads: swap the face buttons
  const down=i=>cur[i] && !PAD.prev[i], up=i=>!cur[i] && PAD.prev[i];
  const menu = menuRoot();
  if(menu){ navMenu(menu, cur, down, A, B, lx, ly, now); }
  else if(S.mode==='playing'){ clearFocus(); playInput(cur, down, up, A, B, X, Y, dt, now, C); }
  else if(down(A) || down(BT.MENU)) dispatchEvent(new KeyboardEvent('keydown', { key:'Enter' }));   // intro / tips: skip ahead
  // blasts, rams, crashes: every bump of the camera shake becomes a kick in the hands
  if(S.shake > PAD.shake0+0.12){ const k=Math.min(1.6, S.shake-PAD.shake0); padRumble(k*0.55, k*0.4, 110+k*110); } PAD.shake0=S.shake;
  // the engine: a low hum in the light motor that grows with the load
  if(C.engine && S.mode==='playing' && S.player && now>PAD.engAt){ PAD.engAt=now+0.11; const th=Math.abs(S.player.throttle||0), sp=Math.min(1, Math.abs(S.player.fwdSpeed||0)/20);
    if(th>0.05 || sp>0.05) padRumble(0, PAD_CFG.engine.base+PAD_CFG.engine.load*th*(1-0.5*sp), 130); }
  PAD.prev=cur;
}
// ---- battle controls ----
function playInput(cur, down, up, A, B, X, Y, dt, now, C){ const p=S.player; if(!p) return;
  // RIGHT STICK lays the gun (screen-relative, follows the camera rotation); let go → auto-aim the nearest foe (option)
  if(PAD.rx || PAD.ry){ _d.set(PAD.rx, 0, PAD.ry); const m=Math.min(1,_d.length()); _d.normalize(); if(S.camYaw) _d.applyAxisAngle(_UP, S.camYaw);
    const R=playerRange()*(0.45+0.55*m); S.aimPoint.set(p.pos.x+_d.x*R, 0, p.pos.z+_d.z*R); S.pointerActive=true; PAD.aimIdle=0; }
  else { PAD.aimIdle+=dt; if(C.assist && PAD.aimIdle>PAD_CFG.assistAfter){ const t=aimTarget(playerRange());
      if(t){ S.aimPoint.set(t.pos.x, 0, t.pos.z); S.pointerActive=true; }
      else if(PAD.aimIdle>PAD_CFG.assistAfter+0.8){ S.aimPoint.set(p.pos.x+Math.sin(p.facing)*14, 0, p.pos.z+Math.cos(p.facing)*14); S.pointerActive=true; } } }   // nothing near: look where you drive
  if(down(BT.RT)){ S.firing=true; fireGun(now, playerRange()); } if(up(BT.RT)) S.firing=false;   // RT = fire (hold = full-auto)
  if(down(BT.LT)) trySpell();                                                                      // LT = skill
  if(down(A)) tryDash();                                                                           // A = dash
  if(down(B)) crewPress(); if(up(B)) crewRelease();                                                // B = crew: tap dismount · hold recall
  if(down(X)) cycleSpell(1);                                                                       // X = next skill
  if(down(Y)){ const ab=document.getElementById('autoBtn'); if(ab) ab.click(); }                   // Y = auto-fire on/off
  if(down(BT.RB)) cycleGun(1); if(down(BT.LB)) cycleGun(-1);                                       // bumpers = guns
  if(down(BT.UP)) musterAll(); if(down(BT.LEFT)) assaultFort(); if(down(BT.DOWN)) callParadrop(); // D-pad = squad orders
  if(down(BT.RIGHT)){ setCamAuto(!S.camAuto); sfx('click'); }
  if(down(BT.L3)) zoomStep(S.zoom>=2.55 ? -9 : 1);                                                 // L3 = zoom out a step (wraps back in)
  if(down(BT.R3)) camReset();
  if(down(BT.MENU)) togglePause();
  if(down(BT.VIEW)) openKeys(null);
}
// ---- menus: a focus ring that the D-pad / left stick moves, A presses, B backs out ----
const FOCUSABLE='.btn, .seg-chip, .bs-mode, .bs-op, .bs-map, .bs-lv, .brcard, .ldcard, .tcard, .shop-tab, .case, .dp-step, .dp-gun, .guide-row, #upcards > *, [data-pad]';
function menuRoot(){ if(S.mode==='playing' && !document.body.classList.contains('shopopen')) return null; const L=[...document.querySelectorAll('.overlay:not(.hidden)')].filter(o=>o.offsetParent!==null || getComputedStyle(o).position==='fixed'); return L[L.length-1]||null; }
function items(root){ return [...root.querySelectorAll(FOCUSABLE)].filter(el=>{ if(el.offsetParent===null) return false; const r=el.getBoundingClientRect(); return r.width>10 && r.height>10; }); }   // off-screen ones count too — focusing scrolls them into view
export function clearFocus(){ if(PAD.focus){ PAD.focus.classList.remove('padfocus'); PAD.focus=null; } }
function setFocus(el){ if(PAD.focus===el) return; clearFocus(); if(!el) return; PAD.focus=el; el.classList.add('padfocus'); try{ el.scrollIntoView({ block:'nearest', inline:'nearest' }); }catch(e){} sfx('click'); }
function navMenu(root, cur, down, A, B, lx, ly, now){
  const L=items(root); if(!L.length) return; if(!PAD.focus || !L.includes(PAD.focus)) setFocus(root.querySelector('.btn-primary:not(.hidden)') && L.includes(root.querySelector('.btn-primary')) ? root.querySelector('.btn-primary') : L[0]);
  let dir=''; if(cur[BT.UP]||ly<-0.6) dir='u'; else if(cur[BT.DOWN]||ly>0.6) dir='d'; else if(cur[BT.LEFT]||lx<-0.6) dir='l'; else if(cur[BT.RIGHT]||lx>0.6) dir='r';
  if(dir && (dir!==PAD.navDir || now>PAD.navAt)){ PAD.navAt=now+(dir===PAD.navDir?PAD_CFG.navRepeat:PAD_CFG.navFirst); PAD.navDir=dir; move(L, dir); } else if(!dir) PAD.navDir='';
  if(down(A) && PAD.focus){ PAD.focus.click(); padRumble(0, 0.3, 60); }
  if(down(B) || (down(BT.MENU) && S.mode==='paused')) goBack(root);
  if(down(BT.VIEW) && keysOpen()) closeKeys();
}
function move(L, dir){ const f=PAD.focus.getBoundingClientRect(), fx=f.left+f.width/2, fy=f.top+f.height/2; let best=null, bs=1e9;
  for(const el of L){ if(el===PAD.focus) continue; const r=el.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2, dx=x-fx, dy=y-fy;
    const main = dir==='u'?-dy : dir==='d'?dy : dir==='l'?-dx : dx, side = (dir==='u'||dir==='d') ? Math.abs(dx) : Math.abs(dy); if(main<4) continue;
    const s=main+side*2.2; if(s<bs){ bs=s; best=el; } }
  if(best) setFocus(best); }
// back: the screen's own back / done button if it has one, else Esc (pause ↔ battle)
function goBack(root){ const L=items(root); const back=L.find(el=>/QUAY LẠI|VỀ MENU|◀|XONG|ĐÓNG|TIẾP TỤC/i.test(el.textContent||''));
  if(back){ back.click(); return; } if(S.mode==='paused'){ togglePause(); return; } dispatchEvent(new KeyboardEvent('keydown', { key:'Escape' })); }

// ---- rumble (dual-motor). strong = low-frequency heavy motor, weak = high-frequency light motor, 0..1 each ----
export function padRumble(strong, weak, ms, force){ const C=padCfg(); if(!C.vib || !PAD.active || !PAD.gp) return; const act=PAD.gp.vibrationActuator; if(!act || !act.playEffect) return;
  const now=performance.now(), lv=Math.max(strong, weak); if(!force && now<PAD.rumbleUntil && lv<PAD.rumbleLv*0.85) return;   // a stronger kick is still running
  PAD.rumbleUntil=now+ms; PAD.rumbleLv=lv; const k=C.vibK;
  try{ const r=act.playEffect('dual-rumble', { startDelay:0, duration:Math.round(ms), strongMagnitude:Math.min(1,strong*k), weakMagnitude:Math.min(1,weak*k) }); if(r && r.catch) r.catch(()=>{}); }catch(e){} }
// the phone-vibration calls the game already makes (crush, ram, pickups…) also rumble the pad
export function padHaptic(ms){ if(!PAD.active) return; const total=Array.isArray(ms) ? ms.reduce((s,v,i)=>s+(i%2?0:v),0) : ms; const k=Math.min(1, total/70); padRumble(k*0.8, 0.25+k*0.6, Math.max(60, total*2.2)); }
// a shot: kick by the gun's recoil (rapid guns buzz, big guns thump)
export function padShot(g){ if(!PAD.active) return; const r=g.recoil||1; if(g.fireCd<0.1) padRumble(0.05, 0.28, 45); else padRumble(Math.min(1, r*0.22), Math.min(1, 0.25+r*0.14), 55+r*28); }
export function padHit(dmg){ if(!PAD.active) return; const k=Math.min(1, dmg/32); padRumble(0.35+k*0.65, 0.4+k*0.4, 140+k*180, true); }
export function padTest(){ padRumble(1, 0.3, 260, true); setTimeout(()=>padRumble(0.2, 1, 260, true), 320); }
addEventListener('gamepadconnected', e=>{ PAD.idx=e.gamepad.index; });
addEventListener('gamepaddisconnected', e=>{ if(e.gamepad.index===PAD.idx){ PAD.idx=-1; PAD.active=false; PAD.gp=null; document.body.classList.remove('pad'); clearFocus(); S.firing=false; } });
