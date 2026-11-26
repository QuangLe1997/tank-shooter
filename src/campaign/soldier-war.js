// campaign/soldier-war.js — Z309 A SOLDIER'S WAR: the waves are men — riflemen and RPG teams, squads, troop helicopters dropping more men down their
//   ropes, a rocket truck later on (Z403 no artillery) — and an attack helicopter comes as a set piece at the tail of a wave (two late on), announced on the
//   radio as it comes in (no-tanks: no armour of any kind on the field).
import { CAV } from '../../config.js';
import { dirCount, enemies, floatText, radio, sfx, waveSize, waveSquads } from '../hub.js';

const W = () => CAV.soldier.war;
const SEEN = new WeakSet(); let _said = -1e9;
// the wave: mostly men; the gunship comes last, as a set piece
export function soldierWaveQueue(stage, wave){ const C = W(), w = C.w, n = Math.max(3, Math.round(waveSize(stage, wave) * C.sizeK * dirCount()));   // (DIR 3 × the difficulty's head count: numbers change, not only health)
  const pool = [['rifle', w.rifle], ['rpg', w.rpg + stage * 0.3]];
  if(stage >= 2 || wave >= 3) pool.push(['heliTroop', w.heli + (stage - 1) * 0.15]);
  if(stage >= 3) pool.push(['launcher', w.truck + (stage - 3) * 0.1]);
  const tot = pool.reduce((s, q) => s + q[1], 0), q = [];
  for(let i = 0; i < n; i++){ let r = Math.random() * tot, t = 'rifle'; for(const [ty, k] of pool){ if((r -= k) <= 0){ t = ty; break; } } q.push(t); }
  const ns = Math.round((waveSquads(stage, wave) + C.squads) * dirCount()); for(let k = 0; k < ns; k++) q.splice(1 + ((Math.random() * q.length) | 0), 0, 'squad');
  if(wave >= C.airFrom || stage >= 2){ const nA = stage >= 4 && wave >= 4 ? 2 : 1; for(let k = 0; k < nA; k++) q.push('gunship'); }
  return q; }
export function updateSoldierWar(dt, now){ announce(now); }
export function clearSoldierWar(){}
// a gunship coming in is news
function announce(now){ for(const e of enemies){ if(SEEN.has(e) || e.type !== 'gunship') continue; SEEN.add(e);
    floatText('TRỰC THĂNG ĐỊCH!', '#ff6a4a', e.pos, 22); if(now - _said > 20){ _said = now; sfx('alarm'); radio('SCH: Trực thăng tấn công! Nấp dưới mái, sau tường — chờ nó lượn thấp rồi bắn B41.'); } } }
