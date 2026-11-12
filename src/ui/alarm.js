// ui/alarm.js — CORE-UNDER-ATTACK ALARM. Z133 early warning: the moment the core takes damage a banner shows its HP and distance, a siren
//   starts once it is hurt or dropping fast (not only under 35%), the pad kicks, and an arrow on the screen edge points at the core when it is off-screen.
import { S, core, feel, sfx, tip, worldToScreen } from '../hub.js';

// ----------------------------- CORE-UNDER-ATTACK ALARM -----------------------------
export let _alarmAt=0, _lastHp=-1, _hitAt=-99, _atkSince=-99, _txtAt=0, _dropT=0, _drop=0;
export function updateCoreAlarm(now){
  const live = !!core && core.hp>0 && S.mode==='playing';
  if(!live){ _lastHp=-1; document.body.classList.remove('corelow','coreatk','coredanger'); return; }
  const f=core.hp/core.maxHp;
  if(_lastHp>=0 && core.hp<_lastHp-0.01){ const d=(_lastHp-core.hp)/core.maxHp;       // the core just took a hit
    if(now-_hitAt>4) _atkSince=now;                                                   // a fresh attack starts: warn now
    _hitAt=now; _drop += d; _dropT=now+6; if(now-_atkSince<0.2) feel('impact', 0.7); }
  _lastHp=core.hp; if(now>_dropT) _drop=0;                                            // percent lost in the last ~6 s
  const atk = now-_hitAt<4, danger = atk && (f<0.6 || _drop>0.12), low = f<0.35;      // danger = hurt, or dropping fast
  document.body.classList.toggle('corelow', low); document.body.classList.toggle('coreatk', atk); document.body.classList.toggle('coredanger', danger);
  if(low) tip('core');
  const loud = low || danger;
  if(loud && now>_alarmAt){ _alarmAt=now+(low?1.3:2.0); sfx('alarm'); }
  else if(atk && now>_alarmAt){ _alarmAt=now+1.0; sfx('corehit'); }
  if(atk || low){ const p=S.player, el=document.getElementById('corewarnT'), ar=document.getElementById('coreArrow');
    const dist = p ? Math.round(Math.hypot(core.pos.x-p.pos.x, core.pos.z-p.pos.z)) : 0;
    if(el && now>_txtAt){ _txtAt=now+0.25; el.textContent = (danger||low ? 'LÕI SẮP VỠ' : 'LÕI ĐANG BỊ TẤN CÔNG')+' · '+Math.round(f*100)+'% · '+dist+' m — VỀ BẢO VỆ'; }
    if(ar){ const s=worldToScreen(core.pos.clone().setY(6)); const W=innerWidth, H=innerHeight, m=46;
      const off = !s.infront || s.x<m || s.x>W-m || s.y<m || s.y>H-m;
      if(off){ let x=s.x, y=s.y; if(!s.infront){ x=W-x; y=H-y; }                       // behind the camera: mirror
        const cx=W/2, cy=H/2, dx=x-cx, dy=y-cy, k=Math.min((W/2-m)/Math.abs(dx||1e-3), (H/2-m)/Math.abs(dy||1e-3));
        ar.style.display='flex'; ar.style.left=(cx+dx*k)+'px'; ar.style.top=(cy+dy*k)+'px'; ar.firstElementChild.style.transform='rotate('+Math.atan2(dy,dx)+'rad)';
        document.getElementById('coreArrowT').textContent='LÕI '+dist+'m'; }
      else ar.style.display='none'; } }
  else { const ar=document.getElementById('coreArrow'); if(ar && ar.style.display!=='none') ar.style.display='none'; }
}
export function __set__alarmAt(v){ _alarmAt=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
