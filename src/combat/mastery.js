// combat/mastery.js — GUN MASTERY: duplicate pickups level a gun up (permanent, per-gun). Boosts dmg / fire-rate / reload.
import { BALANCE } from '../../config.js';
import { GUNS, PROFILE, S, floatText, ringPulse, saveProfile, sfx } from '../hub.js';

// ----- GUN MASTERY: duplicate pickups level a gun up (permanent, per-gun). Boosts dmg / fire-rate / reload. -----
export function gunXp(id){ return (PROFILE.gunXp&&PROFILE.gunXp[id])||0; }
export function gunLevel(id){ const xp=gunXp(id), T=BALANCE.mastery.xp; let lv=1; for(let i=1;i<T.length;i++){ if(xp>=T[i]) lv=i+1; } return lv; }
export function gunDmgMul(id){ return 1 + (gunLevel(id)-1)*BALANCE.mastery.dmgPerLevel; }       // +10%/lvl
export function gunFireMul(id){ return 1 - (gunLevel(id)-1)*BALANCE.mastery.fireCdPerLevel; }   // ×fireCd → smaller = faster
export function gunReloadMul(id){ return 1 - (gunLevel(id)-1)*BALANCE.mastery.reloadPerLevel; } // ×reload → smaller = faster
export function gunXpToNext(id){ const lv=gunLevel(id), T=BALANCE.mastery.xp; if(lv>=BALANCE.mastery.maxLevel) return null; return { have:gunXp(id)-T[lv-1], need:T[lv]-T[lv-1] }; }
export function addGunXp(id){
  if(!PROFILE.gunXp) PROFILE.gunXp={};
  const before=gunLevel(id); PROFILE.gunXp[id]=(PROFILE.gunXp[id]||0)+1; const after=gunLevel(id); saveProfile();
  const p=S.player, g=GUNS[id]; if(!p) return;
  if(after>before){ floatText(g.name+'  ⮕  LV '+after+'!', '#ffd24a', p.pos, 26); sfx('levelup'); ringPulse(p.pos, 0xffd24a, 3); }
  else { const n=gunXpToNext(id); floatText(n? (g.name+'  '+n.have+'/'+n.need+' ▸ LV'+(gunLevel(id)+1)) : (g.name+'  ★ MAX'), '#aef0a0', p.pos, 18); }
}
