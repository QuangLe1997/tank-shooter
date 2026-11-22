// ui/loadout.js — Z103 split from ui/menus.js. KHO SÚNG — Z411 THE SOLDIER'S ARSENAL (from the start screen, CHUẨN BỊ TRẬN or the pause): his hand
//   weapons, every one, the B41 marked as always carried; the one tapped is the gun he carries in (PROFILE.trooperGun, as the gear step's row) — from the
//   pause it is in his hands at once (no-tanks: the tank's five-gun loadout and its ★ default gun are gone)
import { GUNS, KIT_GUN, PRIMARY_GUNS, PROFILE, S, gunPicHTML, gunTierTx, hide, refreshStartUI, saveProfile, sfx, show, tapBtn, tapEl, updateGunHUD, setupBack } from '../hub.js';

let _solSel = 'carbine';
export let _ldFrom = 'start';
export function renderLoadout(){
  const grid = document.getElementById('ldgrid'); if(!grid) return; grid.innerHTML = '';
  const e = document.querySelector('#loadout .subtitle'); if(e) e.innerHTML = 'NGƯỜI LÍNH · chọn súng chính (' + PRIMARY_GUNS.length + ' khẩu) · B41 luôn mang theo · súng khác nhặt trong trận';
  for(const id of [...PRIMARY_GUNS, KIT_GUN]){ const g = GUNS[id], kit = id === KIT_GUN, on = kit || id === _solSel, card = document.createElement('div');
    card.className = 'ldcard' + (on ? ' on' : '');
    card.innerHTML = (on ? '<div class="num">' + (kit ? 'B41' : 'CHÍNH') + '</div>' : '') + '<div class="pick"></div>' + gunPicHTML(id, 'gp-ld') + '<div class="nm">' + g.name + '</div><div class="tr">' + (kit ? 'LUÔN MANG THEO' : gunTierTx(id)) + '</div>';
    if(!kit) tapEl(card, () => { _solSel = id; sfx('click'); renderLoadout(); }); grid.appendChild(card); } }
export function openLoadout(){ _ldFrom = (S.mode === 'paused') ? 'pause' : !document.getElementById('battleSetup').classList.contains('hidden') ? 'battleSetup' : 'start';   // Z354 from CHUẨN BỊ TRẬN: back there
  _solSel = PRIMARY_GUNS.includes(PROFILE.trooperGun) ? PROFILE.trooperGun : 'carbine';
  hide(_ldFrom); renderLoadout(); show('loadout'); sfx('click'); }
// his main gun swapped mid-battle: the one he has already is taken up, else it takes the starting gun's place in the rack (what he picked up stays)
function applySoldierMain(){ const p = S.player; if(!p || !p.guns) return; let i = p.guns.findIndex(g => g.id === _solSel);
  if(i < 0){ i = Math.max(0, p.guns.findIndex(g => g.id !== KIT_GUN)); p.guns[i] = { id:_solSel, ammo:GUNS[_solSel].mag, rU:0, rD:0 }; } p.gunIdx = i; updateGunHUD(); }
export function closeLoadout(){ PROFILE.trooperGun = _solSel; saveProfile(); hide('loadout');
  if(_ldFrom === 'pause'){ applySoldierMain(); if(S.mode === 'paused') show('pause'); }   // the change takes effect on the current run
  else if(_ldFrom === 'battleSetup'){ show('battleSetup'); setupBack(); }
  else if(S.mode === 'start') show('start');
  refreshStartUI(); sfx('click'); }
tapBtn('arsenalBtn', openLoadout);
tapBtn('arsenalBtnP', openLoadout);
tapBtn('ldDone', closeLoadout);
