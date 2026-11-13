// combat/mastery.js — GUN MASTERY: duplicate pickups level a gun up (permanent, per-gun). Boosts dmg / fire-rate / reload.
import { BALANCE, GUN_MODS } from '../../config.js';
import { GUNS, PROFILE, S, floatText, ringPulse, saveProfile, sfx } from '../hub.js';

// ----- GUN MASTERY: duplicate pickups level a gun up (permanent, per-gun). Boosts dmg / fire-rate / reload. -----
export function gunXp(id){ return (PROFILE.gunXp&&PROFILE.gunXp[id])||0; }
export function gunLevel(id){ const xp=gunXp(id), T=BALANCE.mastery.xp; let lv=1; for(let i=1;i<T.length;i++){ if(xp>=T[i]) lv=i+1; } return lv; }
// Z115 gun parts: PROFILE.gunMods[id] = { barrel, action, mag } levels (0..GUN_MODS.max)
export function gunMod(id, k){ const m=PROFILE.gunMods&&PROFILE.gunMods[id]; return (m&&m[k])||0; }
export function addGunMod(id, k){ if(!PROFILE.gunMods) PROFILE.gunMods={}; const m=PROFILE.gunMods[id]||(PROFILE.gunMods[id]={}); if((m[k]||0)>=GUN_MODS.max) return -1; m[k]=(m[k]||0)+1; saveProfile(); return m[k]; }
export function gunModTotal(id){ return gunMod(id,'barrel')+gunMod(id,'action')+gunMod(id,'mag'); }
export function gunDmgMul(id){ return (1 + (gunLevel(id)-1)*BALANCE.mastery.dmgPerLevel) * (1 + gunMod(id,'barrel')*GUN_MODS.barrel.dmg); }       // +10%/lvl · parts on top
export function gunFireMul(id){ return (1 - (gunLevel(id)-1)*BALANCE.mastery.fireCdPerLevel) * (1 - gunMod(id,'action')*GUN_MODS.action.fire); }   // ×fireCd → smaller = faster
export function gunReloadMul(id){ return (1 - (gunLevel(id)-1)*BALANCE.mastery.reloadPerLevel) * (1 - gunMod(id,'action')*GUN_MODS.action.reload); } // ×reload → smaller = faster
export function gunMagMul(id){ return 1 + gunMod(id,'mag')*GUN_MODS.mag.mag; }
export function gunRngMul(id){ return 1 + gunMod(id,'barrel')*GUN_MODS.barrel.rng; }
export function gunXpToNext(id){ const lv=gunLevel(id), T=BALANCE.mastery.xp; if(lv>=BALANCE.mastery.maxLevel) return null; return { have:gunXp(id)-T[lv-1], need:T[lv]-T[lv-1] }; }
export function addGunXp(id){
  if(!PROFILE.gunXp) PROFILE.gunXp={};
  const before=gunLevel(id); PROFILE.gunXp[id]=(PROFILE.gunXp[id]||0)+1; const after=gunLevel(id); saveProfile();
  const p=S.player, g=GUNS[id]; if(!p) return;
  if(after>before){ floatText(g.name+'  ⮕  CẤP '+after+'!', '#ffd24a', p.pos, 26); sfx('levelup'); ringPulse(p.pos, 0xffd24a, 3); }
  else { const n=gunXpToNext(id); floatText(n? (g.name+'  '+n.have+'/'+n.need+' ▸ CẤP '+(gunLevel(id)+1)) : (g.name+'  ★ TỐI ĐA'), '#aef0a0', p.pos, 18); }
}
