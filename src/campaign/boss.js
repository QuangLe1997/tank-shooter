// campaign/boss.js — THE STAGE'S GENERAL (no-tanks: Z96 the super-heavy, its weak points, armour arcs, phases, shield pylons, mines and lasers are gone):
//   the commander of the stage waits in his citadel and meets the soldier on foot with his bodyguards (campaign/general-duel.js); his fall wins the stage —
//   the payout, the citadel falls, the next stage opens, the pick of rewards — and the last one wins the campaign

import { reportRun, ARENA, BOSS_ALT, BOSS_DEFS, BOSS_NEW, PROFILE, S, campaignCleared, celebrate, duelOn, fortBossDown, generalStart, openUpgrade, recordRun, refreshStartUI, saveProfile, saveProgress, show, showBanner, sfx, updateHUD } from '../hub.js';

export function bossForStage(st){ const alt=(S.loop||0)%2===1 && BOSS_ALT[st]; return (alt && BOSS_NEW.find(b=>b.id===alt)) || BOSS_DEFS[Math.min(st-1, BOSS_DEFS.length-1)]; }   // Z161 odd NG+ loops bring the new generals
// the general takes the field: in the citadel f (its yard), else (a field without forts) at the far end of the field
export function startBoss(now, f){ if(duelOn() || !S.player) return; const def = bossForStage(S.stage), at = f ? { x:f.x, z:f.z } : { x:0, z:-ARENA * 0.5 };
  generalStart(at, def, n => bossStageWon(n, def)); }
// the stage is won: the citadel falls, the next stage opens, the pick of rewards
export function bossStageWon(now, bdef){
  showBanner('ĐÃ HẠ '+bdef.name+'!', '#8cbf3f'); sfx('levelup');
  fortBossDown();                                   // Z107 the citadel falls with its commander
  const wasFinal = S.stage >= BOSS_DEFS.length;     // beat the last boss → victory
  S.awaitingUpgrade=true; S.wave=0;                 // freeze wave system until upgrade chosen
  S.stage++; updateHUD(); saveProgress(); campaignCleared((S.loop||0)*5 + S.stage-1); reportRun({ cleared:true });   // Z163 the cleared stage counts on the leaderboard   // Z107 next campaign level opens   // stage-clear coin bonus (×CONTRACT ×DIFFICULTY) + advance the resumable checkpoint
  celebrate('victory', 0, 0);                                                         // Z140 fireworks, cheering troops — then the next screen
  if(wasFinal){ setTimeout(()=>{ if(S.mode!=='gameover') victory(); }, 5600); }
  else { setTimeout(()=>{ if(S.mode==='playing') openUpgrade(); }, 5400); }   // (Z182 not if the run already ended — e.g. a training that closed itself)
}
export function victory(){
  S.mode='victory';
  document.getElementById('vic-score').textContent = S.score.toLocaleString();
  recordRun();
  const nl=(S.loop||0)+1;
  if(!(S.run && S.run.mode==='custom')){ PROFILE.save={ loop:nl, stage:1, score:S.score }; saveProfile(); } else S.runCfg={ ...S.run, level:nl*5+1 }; refreshStartUI();   // custom: the next loop keeps your map/hour/weather   // advance the campaign into the next NG+ loop
  const nb=document.getElementById('ngplusBtn'); if(nb) nb.textContent='VÀO VÒNG MỚI+'+nl+' ▶';
  const vs=document.querySelector('#victory .subtitle'); if(vs) vs.textContent='Vòng mới+'+nl+' đang chờ — địch mạnh hơn, thưởng lớn hơn';
  document.body.classList.remove('corelow');
  show('victory'); sfx('levelup');
}
