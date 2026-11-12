// ui/loadout.js — Z103 split from ui/menus.js. ARSENAL / LOADOUT — pick up to LOADOUT_MAX guns from the collection (from the start screen or mid-run pause).
import { GUNS, LOADOUT_MAX, PROFILE, S, hide, refreshStartUI, saveProfile, sfx, show, svgMarkup, tapBtn, tapEl, updateGunHUD } from '../hub.js';

// ---- arsenal / loadout (pick ≤5 from your collection) ----
export let _ldSel=[];
export function renderLoadout(){
  const grid=document.getElementById('ldgrid'); if(!grid) return; grid.innerHTML='';
  Object.keys(GUNS).forEach(id=>{                            // show every gun: owned = selectable, the rest = locked (collection goal)
    const g=GUNS[id], owned=PROFILE.ownedGuns.includes(id), on=_ldSel.includes(id);
    const card=document.createElement('div');
    card.className='ldcard'+(owned?'':' locked')+(on?' on':'');
    const num = on ? ('<div class="num">'+(_ldSel.indexOf(id)+1)+'</div>') : '', star = on ? ('<div class="dflt'+(dflt()===id?' is':'')+'" title="Súng mặc định (bắt đầu trận với súng này)">'+(dflt()===id?'★ MẶC ĐỊNH':'☆')+'</div>') : '';
    card.innerHTML = num+star+'<div class="pick"></div><div class="gi">'+svgMarkup(g.svg||'gun')+'</div><div class="nm">'+g.name+'</div><div class="tr">BẬC '+g.tier+'</div>';
    if(owned){ tapEl(card, ()=>toggleLd(id)); const st=card.querySelector('.dflt'); if(st) { st.addEventListener('click', e=>{ e.stopPropagation(); setDefaultGun(id); }); st.addEventListener('touchstart', e=>{ e.preventDefault(); e.stopPropagation(); setDefaultGun(id); }, {passive:false}); } }
    grid.appendChild(card);
  });
  const c=document.getElementById('ldcount'); if(c) c.textContent=_ldSel.length+'/'+LOADOUT_MAX;
}
// Z129 the DEFAULT gun: first in hand every battle, and what LB+RB (or key 0) jumps back to. Always one of the selected loadout.
export function dflt(){ return _ldSel.includes(PROFILE.defaultGun) ? PROFILE.defaultGun : _ldSel[0]; }
export function setDefaultGun(id){ if(!_ldSel.includes(id)) return; PROFILE.defaultGun=id; saveProfile(); sfx('click'); renderLoadout(); }
export function toggleLd(id){ const i=_ldSel.indexOf(id);
  if(i>=0){ if(_ldSel.length>1) _ldSel.splice(i,1); }        // keep at least one weapon
  else { if(_ldSel.length>=LOADOUT_MAX) return; _ldSel.push(id); }
  sfx('click'); renderLoadout(); }
export let _ldFrom='start';
export function openLoadout(){ _ldFrom = (S.mode==='paused')?'pause':'start'; hide(_ldFrom); _ldSel=PROFILE.loadout.filter(k=>PROFILE.ownedGuns.includes(k)).slice(0,LOADOUT_MAX); if(!_ldSel.length)_ldSel=['rifle']; renderLoadout(); show('loadout'); sfx('click'); }
export function applyLoadoutToRun(){                                  // re-pick mid-battle: swap the active guns live (keep ammo of guns you already had)
  const p=S.player; if(!p) return;
  let want=PROFILE.loadout.slice(0,LOADOUT_MAX); if(!want.length) want=['rifle'];
  p.guns = want.map(id=>{ const ex=p.guns.find(g=>g.id===id); return ex || {id, ammo:GUNS[id].mag, rU:0, rD:0}; });
  if(p.gunIdx>=p.guns.length) p.gunIdx=0;
  updateGunHUD();
}
export function closeLoadout(){ PROFILE.loadout=_ldSel.slice(0,LOADOUT_MAX); if(!PROFILE.loadout.length)PROFILE.loadout=['rifle']; PROFILE.defaultGun=dflt()||'rifle'; saveProfile(); hide('loadout');
  if(_ldFrom==='pause'){ applyLoadoutToRun(); if(S.mode==='paused') show('pause'); }   // changes take effect on the current run
  else if(S.mode==='start') show('start');
  refreshStartUI(); sfx('click'); }
tapBtn('arsenalBtn', openLoadout);
tapBtn('arsenalBtnP', openLoadout);
tapBtn('ldDone', closeLoadout);
