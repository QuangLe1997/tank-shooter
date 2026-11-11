// actors/command.js — Z107 SQUAD COMMANDS: muster everyone on the map to the tank (T), storm the nearest fortress (X), call our helicopter to drop paratroopers (B) — keys + the phone's command strip.
import * as THREE from 'three';
import { COMMAND, TROOPS } from '../../config.js';
import { FORTS, FT, MOBILE, S, floatText, fortSealed, launchParadrop, radio, ringPulse, sfx, showBanner, tapBtn } from '../hub.js';

export const CMD = { paraAt:0 };
// what a soldier does under an active order (null = carry on with his own judgement)
export function cmdGoal(a, now, foe){ const C=S.cmd; if(!C || now>C.until) return null; const p=S.player;
  const near = foe && Math.hypot(foe.pos.x-a.pos.x, foe.pos.z-a.pos.z) < COMMAND.fightNear[C.kind]; if(near) return null;   // a foe in his face → fight first
  if(C.kind==='muster'){ const ang=(a.slot||0)*2.4, r=3+((a.slot||0)%3)*1.6; return [p.pos.x+Math.sin(ang)*r, p.pos.z+Math.cos(ang)*r]; }
  if(C.kind==='assault'){ const f=C.f; if(!f || f.captured){ S.cmd=null; return null; }
    if(!f.breached){ const ang=(a.slot||0)*0.9-1.8, r=11+((a.slot||0)%2)*3, ux=f.ox-f.x, uz=f.oz-f.z, L=Math.hypot(ux,uz)||1, bx=f.ox+ux/L*6, bz=f.oz+uz/L*6;
      return [bx+(-uz/L)*Math.sin(ang)*r, bz+(ux/L)*Math.sin(ang)*r]; }                                     // fan out in front of the gate, firing on it
    const c=f.cmd && f.cmd.pos ? f.cmd.pos : f; return [c.x+(Math.random()-0.5)*6, c.z+(Math.random()-0.5)*6]; }   // through the breach → for the commander
  return null; }
export function musterAll(){ if(S.mode!=='playing') return; const now=performance.now()/1000;
  S.cmd={ kind:'muster', until:now+COMMAND.musterT }; for(const a of FT){ a.thinkAt=0; a.hold=null; }
  const p=S.player; ringPulse(new THREE.Vector3(p.pos.x,0,p.pos.z), 0x9be04a, 7); floatText('TẬP KẾT · '+FT.length+' LÍNH', '#9be04a', p.pos, 18); sfx('click');
  radio('Toàn bộ lính — tập kết về xe chỉ huy!'); }
export function assaultFort(){ if(S.mode!=='playing') return; const now=performance.now()/1000, p=S.player;
  const open=FORTS.filter(f=>!f.captured && f.g && !fortSealed(f)); if(!open.length){ floatText('KHÔNG CÓ THÀNH NÀO ĐỂ ĐÁNH', '#ffcf5a', p.pos, 15); return; }
  open.sort((a,b)=>Math.hypot(a.x-p.pos.x,a.z-p.pos.z)-Math.hypot(b.x-p.pos.x,b.z-p.pos.z)); const f=open[0];
  S.cmd={ kind:'assault', f, until:now+COMMAND.assaultT }; for(const a of FT){ a.thinkAt=0; a.hold=null; }
  showBanner('XUNG PHONG — '+f.name+'!', '#ff8a3a'); radio(FT.length ? ('Cả đội tiến về '+f.name+' — dồn hoả lực vào cổng!') : 'Chưa có lính — gọi lính dù (B) hoặc giải cứu tù binh trước!'); sfx('levelup'); }
export function callParadrop(){ if(S.mode!=='playing') return; const now=performance.now()/1000, P=COMMAND.para, p=S.player;
  if(now<CMD.paraAt){ floatText('TRỰC THĂNG ĐANG QUAY VỀ · '+Math.ceil(CMD.paraAt-now)+'s', '#ffcf5a', p.pos, 14); return; }
  const cap=(MOBILE?TROOPS.fireteam.capMobile:TROOPS.fireteam.cap)+P.extraCap; if(FT.length>=cap){ floatText('ĐỦ QUÂN RỒI', '#ffcf5a', p.pos, 14); return; }
  CMD.paraAt=now+(MOBILE?P.cdMobile:P.cd);
  const C=S.cmd, at = (C && C.kind==='assault' && C.f && !C.f.captured) ? [C.f.ox, C.f.oz] : null;
  launchParadrop(now, { friendly:true, at, n:Math.min(cap-FT.length, Math.round((MOBILE?P.troopsMobile:P.troops)[0]+Math.random()*((MOBILE?P.troopsMobile:P.troops)[1]-(MOBILE?P.troopsMobile:P.troops)[0]))) });
  radio('Trực thăng quân ta đang tới — lính dù sẽ nhảy xuống chỗ vòng xanh!'); sfx('click'); }
export function cmdCooldownTx(now){ return now<CMD.paraAt ? Math.ceil(CMD.paraAt-now)+'s' : ''; }
// phone strip: the paratrooper button shows its cooldown (written only when the number changes)
let _cdTx=null;
export function updateCmdUI(now){ if(!MOBILE) return; const t=cmdCooldownTx(now); if(t===_cdTx) return; _cdTx=t; const el=document.getElementById('mParaCd'); if(el){ el.textContent=t; el.classList.toggle('on', !!t); } }
// Z118 T / X / B now live in the binding table (input/bindings.js)
tapBtn('mMuster', musterAll); tapBtn('mAssault', assaultFort); tapBtn('mPara', callParadrop);
