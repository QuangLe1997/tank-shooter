// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import { S, core, sfx, tip } from '../hub.js';

// ----------------------------- CORE-UNDER-ATTACK ALARM -----------------------------
export let _alarmAt=0;
export function updateCoreAlarm(now){
  const low = !!core && core.hp>0 && core.hp/core.maxHp < 0.35 && S.mode==='playing';
  document.body.classList.toggle('corelow', low); if(low) tip('core');
  if(low && now>_alarmAt){ _alarmAt=now+1.3; sfx('alarm'); }
}
export function __set__alarmAt(v){ _alarmAt=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
