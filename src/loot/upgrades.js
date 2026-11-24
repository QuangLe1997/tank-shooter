// loot/upgrades.js — THE STAGE WON: pick 1 of 3 of the soldier's perks (game/soldier-rank.js), then the next battlefield is built and briefed
import { OBJECTIVES } from '../../config.js';
import { SOLDIER, gpuHeld, gpuRelease, modelEpoch, BIOME, S, STAGE_TAGS, TOD_LABEL, WAVE, applyBiome, biomeVi, buildBlocks, buildLava, buildObjective, buildTrails, buildUnderground, clearRelic, clearSoldiers, conditionsText, deploySoldiers, hide, iconEl, opFor, openBriefing, parkAtSpawn, rebuildCore, sfx, show, showBanner, updateHUD, blendWhenReady, scene, soldierStagePerks } from '../hub.js';

export function openUpgrade(){
  S.mode='upgrade';
  const wrap=document.getElementById('upcards'); wrap.replaceChildren();
  const pick=soldierStagePerks();   // Z350 the soldier picks from his own perks
  for(const u of pick){
    const card=document.createElement('div'); card.className='upcard';
    const ic=document.createElement('div'); ic.className='ic'; ic.appendChild(iconEl(u.ic));
    const nm=document.createElement('div'); nm.className='nm'; nm.textContent=u.nm;
    const ds=document.createElement('div'); ds.className='ds'; ds.textContent=u.ds;
    const pw=document.createElement('div'); pw.className='pw'; pw.textContent = u.tag || '';   // Z107 · Z350 a soldier's perk shows its level
    card.append(ic,nm,ds,pw);
    const choose=()=>chooseUpgrade(u);
    card.addEventListener('click', choose);
    card.addEventListener('touchstart', e=>{ e.preventDefault(); choose(); }, {passive:false});
    wrap.appendChild(card);
  }
  show('upgrade'); sfx('powerup');
}
export function playStageTransition(stage, biomeName, accentHex, quiet){
  if(quiet) return;   // Z138 no card / banner after the 3-2-1: the mission line + battlefield conditions are shown during the countdown instead
  const w=document.getElementById('stagewipe'); if(!w) return;
  w.style.setProperty('--swaccent', accentHex);
  document.getElementById('sw-stage').textContent = 'MÀN '+stage;
  document.getElementById('sw-biome').textContent = biomeVi(biomeName) + (S.tod ? ' · '+TOD_LABEL[S.tod] : '');
  const op=opFor(stage); document.getElementById('sw-tag').textContent = op.title || STAGE_TAGS[(stage-1)%STAGE_TAGS.length];
  document.getElementById('sw-objtx').textContent = 'MỤC TIÊU · PHÁ '+((OBJECTIVES[op.obj]||{}).vi||(OBJECTIVES[op.obj]||{}).name||'CĂN CỨ ĐỊCH');
  document.getElementById('sw-clear').style.display = stage>1 ? '' : 'none';   // the opening stage has nothing to "clear" yet
  w.classList.remove('show'); void w.offsetWidth;     // restart the CSS animations
  w.classList.add('show'); sfx('levelup');
  setTimeout(()=>sfx('wave'), 900);                   // rising tension
  setTimeout(()=>w.classList.remove('show'), 2700);
  setTimeout(()=>{ const ct=conditionsText(); if(ct) showBanner('ĐIỀU KIỆN: '+ct, '#9fd8ff'); }, 2900);   // tell the player which guns this battlefield favours
}
export function chooseUpgrade(u){
  clearRelic();   // Z154 last stage's relic power ends with it
  u.apply(S.player); sfx('powerup'); updateHUD();
  hide('upgrade');
  parkAtSpawn(); const held=gpuHeld(); modelEpoch();   // Z396 what the last battlefield holds on the GPU · Z180 the new battlefield is built around our spawn: whoever won the last stage inside a fort must not wake up inside the next one's walls
  applyBiome(S.stage); buildBlocks(); buildObjective(); buildLava(); buildUnderground(); buildTrails();   // Z187 · Z225
  rebuildCore(S.stage); gpuRelease(held);   // grander monument for the new stage (preserves max HP, heals to full) · Z396 then the last battlefield's geometries and maps off the GPU
  blendWhenReady(scene);                 // Z325 the new battlefield's buildings and models graded into its colours while the briefing is up
  clearSoldiers(); deploySoldiers(SOLDIER.base);   // a fresh guard squad each stage
  S.awaitingUpgrade=false; WAVE.active=false; S.wave=0;
  openBriefing({ stage:S.stage, biomeName:BIOME.name, accentHex:'#'+BIOME.accent.toString(16).padStart(6,'0') });   // pick a CONTRACT, then the stage transition + waves fire on confirm
}
