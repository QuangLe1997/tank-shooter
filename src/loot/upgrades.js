// loot/upgrades.js — ROGUELITE UPGRADES (pick 1 of 3 after each boss)
import { OBJECTIVES, TROOPS } from '../../config.js';
import { BIOME, S, STAGE_TAGS, TOD_LABEL, WAVE, __set_ridersUnlocked, applyBiome, biomeVi, buildBlocks, buildObjective, clearSoldiers, clearWrecks, conditionsText, core, crewTarget, deployOwnedDrone, deployRiders, deploySoldiers, floatText, fmtP, guardTarget, hide, iconEl, opFor, openBriefing, pickGain, rebuildCore, ridersUnlocked, sfx, show, showBanner, updateHUD, updateWeaponHUD } from '../hub.js';

// ===== ROGUELITE UPGRADES (pick 1 of 3 after each boss) =====
export const UPGRADES = [
  { ic:'shield', nm:'GIÁP DÀY',      ds:'+30 máu tối đa',     apply(p){ p.maxHp+=30; p.hp+=30; } },
  { ic:'burst', nm:'HOẢ LỰC',       ds:'+20% sát thương',    apply(p){ p.dmgMul*=1.2; } },
  { ic:'bolt', nm:'BẮN NHANH',        ds:'+15% tốc độ bắn',      apply(p){ p.fireMul*=0.85; } },
  { ic:'dash', nm:'CƠ ĐỘNG',       ds:'+15% tốc độ',        apply(p){ p.speedMul*=1.15; } },
  { ic:'dash', nm:'LƯỚT NHANH',    ds:'−25% hồi chiêu lướt',      apply(p){ p.dashCdMul*=0.75; } },
  { ic:'drop', nm:'HÚT MÁU',       ds:'+6 máu mỗi lần hạ địch', apply(p){ p.lifesteal+=6; } },
  { ic:'crosshair', nm:'CHÍ MẠNG',      ds:'+15% chí mạng (×2)', apply(p){ p.crit=Math.min(0.6,p.crit+0.15); } },
  { ic:'spark', nm:'THI TRIỂN NHANH',    ds:'−20% hồi chiêu kỹ năng',      apply(p){ p.spellCdMul*=0.8; } },
  { ic:'target', nm:'TẦM XA',       ds:'+20% tầm bắn',       apply(p){ p.rangeMul*=1.2; } },
  { ic:'tank', nm:'+1 MẠNG',       ds:'Thêm 1 mạng',        apply(p){ p.lives++; } },
  { ic:'bunker', nm:'GIA CỐ LÕI', ds:'+80 máu Lõi',     apply(p){ if(core){core.maxHp+=80; core.hp+=80;} } },
  { ic:'up', nm:'NÂNG SÚNG',   ds:'Súng +1 cấp',      apply(p){ p.weaponLvl=Math.min(3,p.weaponLvl+1); updateWeaponHUD(); } },
];
export function openUpgrade(){
  S.mode='upgrade';
  const wrap=document.getElementById('upcards'); wrap.replaceChildren();
  const pool=UPGRADES.slice(), pick=[];
  for(let i=0;i<3 && pool.length;i++) pick.push(pool.splice((Math.random()*pool.length)|0,1)[0]);
  for(const u of pick){
    const card=document.createElement('div'); card.className='upcard';
    const ic=document.createElement('div'); ic.className='ic'; ic.appendChild(iconEl(u.ic));
    const nm=document.createElement('div'); nm.className='nm'; nm.textContent=u.nm;
    const ds=document.createElement('div'); ds.className='ds'; ds.textContent=u.ds;
    const pg=pickGain(u), pw=document.createElement('div'); pw.className='pw'; pw.textContent = pg>0 ? ('⚔ +'+fmtP(pg)+' sức mạnh') : 'hỗ trợ · không đổi sức mạnh';   // Z107
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
  u.apply(S.player); sfx('powerup'); updateHUD();
  hide('upgrade');
  applyBiome(S.stage); buildBlocks(); clearWrecks(); buildObjective();
  rebuildCore(S.stage);                  // grander monument for the new stage (preserves max HP, heals to full)
  clearSoldiers(); deploySoldiers(guardTarget()); deployOwnedDrone();   // fresh guard squad + relaunch owned escort drone each stage
  if(S.stage>=TROOPS.ridersFrom && !ridersUnlocked){ __set_ridersUnlocked(true); deployRiders(crewTarget()); if(S.player) floatText('KÍP LÍNH ĐÃ LÊN XE', '#9bd14a', S.player.pos, 18); }   // crew mount the tank from Stage 3 (base + TANK CREW upgrade)
  S.awaitingUpgrade=false; WAVE.active=false; S.wave=0;
  openBriefing({ stage:S.stage, biomeName:BIOME.name, accentHex:'#'+BIOME.accent.toString(16).padStart(6,'0') });   // pick a CONTRACT, then the stage transition + waves fire on confirm
}
