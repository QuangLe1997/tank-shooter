// loot/soldier-arms.js — Z352 ARMS OFF THE FIELD (soldier mode only): what a dead enemy carried is his to take. A rifleman sometimes drops his rifle, an RPG
//   man his B41 more often, a vehicle's crew a heavier weapon; the general a pair of the best. Walk over it (the loot magnet pulls it in): a gun he has not got
//   joins his rack, one he has climbs a star — each star more damage and a quicker trigger (combat/soldier-fire.js), shown as ★ on his weapon chip. His own
//   loot also brings a MEDAL (experience toward the next rank) and an AMMO CRATE (every gun full, his skill ready again). The HQ's SUPPLY DROP (a rank, a perk)
//   lands a new gun, a medkit and a crate beside him.
import * as THREE from 'three';
import { TROOPER } from '../../config.js';
import { GUNS, MODE, POWERUPS, S, dropPowerup, floatText, gainXp, magCap, ringPulse, sfx, trooperGive, trooperGunPick, trooperLoot, updateGunHUD } from '../hub.js';

// an enemy's weapon as a pick-up (the gun crate's look, the gun's own name and photo on the toast)
export function wpnDef(id){ const g = GUNS[id]; return { id:'wpn_' + id, gun:id, svg:'gun', color:0xaef0a0, vi:g.name, ds:'Súng của địch · khẩu đã có thì lên ★', cat:'gun', tier:(g.tier || 1) >= 3 ? 2 : 1,
  apply(p){ p._gotGun = id; trooperGive(id); } }; }
export const MEDAL = { id:'medal', svg:'star', color:0xffd86a, vi:'HUY CHƯƠNG', ds:'Kinh nghiệm cho cấp bậc kế tiếp', cat:'gem', tier:1,
  apply(p){ gainXp(Math.round(TROOPER.drop.medalXp * (1 + 0.25 * ((S.stage || 1) - 1))), p.pos); } };
export const AMMO = { id:'ammobox', svg:'mag', color:0xd8c070, vi:'THÙNG ĐẠN', ds:'Đầy đạn mọi súng · kỹ năng sẵn sàng ngay', cat:'ammo', tier:0,
  apply(p){ for(const g of p.guns){ g.ammo = magCap(GUNS[g.id]); g.rU = 0; } p.spellCdUntil = 0; updateGunHUD(); } };
// the soldier's loot table: now and then a medal or an ammo crate, else what a man can use (loot/powerups.js trooperLoot)
export function soldierLoot(tier){ if(Math.random() < TROOPER.drop.item) return Math.random() < 0.5 ? MEDAL : AMMO; return trooperLoot(tier); }
// the heaviest hand weapons he has not got yet (else his own, for a star)
function heavyPick(n){ const have = new Set(S.player.guns.map(g => g.id)), all = Object.keys(GUNS).filter(id => GUNS[id].trooper), out = [];
  const pool = all.filter(id => !have.has(id)).sort((a, b) => (GUNS[b].tier || 1) - (GUNS[a].tier || 1));
  while(out.length < n){ const id = pool.shift() || S.player.guns[(Math.random() * S.player.guns.length) | 0].id; out.push(id); } return out; }
// killEnemy (through game/soldier-rank.js soldierKill): his weapon on the ground, maybe
export function armsDrop(e){ if(MODE.id !== 'soldier' || !S.player) return; const D = TROOPER.drop;
  if(e.general){ for(const id of heavyPick(2)) dropPowerup(e.pos, 2, wpnDef(id)); dropPowerup(e.pos, 1, MEDAL); return; }
  let id = null;
  if(e.def.inf){ if(Math.random() < (D[e.type] ?? D.rifle)) id = e.def.rpg ? 't_rpg' : 't_ak'; }   // (Z355 a rifleman's AK-47)
  else if(!e.def.air && Math.random() < D._veh) id = trooperGunPick();
  if(id) dropPowerup(e.pos, 1, wpnDef(id)); }
// the HQ's supply drop, a few metres ahead of him
export function supplyDrop(){ const p = S.player; if(!p) return; const f = p.facing || 0, at = new THREE.Vector3(p.pos.x + Math.sin(f) * 4, 0, p.pos.z + Math.cos(f) * 4);
  dropPowerup(at, 2, wpnDef(trooperGunPick())); dropPowerup(at, 1, POWERUPS.find(u => u.id === 'heal')); dropPowerup(at, 0, AMMO);
  ringPulse(at, 0xffd86a, 4); floatText('THẢ DÙ TIẾP TẾ', '#ffd86a', { x:at.x, y:3, z:at.z }, 20); sfx('whoosh'); }
