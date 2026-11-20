// campaign/soldier-war.js — Z309 A SOLDIER'S WAR (soldier mode only; the tank keeps campaign/waves.js and its direct-fire duels): the waves are men —
//   riflemen and RPG teams, squads, scout cars, carriers dropping more men, troop helicopters later on, the odd self-propelled gun calling its barrage — and
//   armour comes as a set piece: a tank (two late on) at the tail of a wave, announced on the radio as it rolls in. Against a man a tank does not "hit a
//   hull": it lays its gun on a spot — a red ring blinks there, faster as it settles — then fires, and the shell bursts on that spot. Out of the ring, it
//   misses; caught in it, the nearer the centre the worse. Its quick-firing guns (autocannons, machine guns) still fire rounds as before.
import { CAV } from '../../config.js';
import { S, bigExplode, blastAllies, damagePlayer, disposeArtZone, enemies, enemyMuzzleFX, floatText, heightAt, makeArtLock, radio, sfx, spawnPart, tankRecoil, waveSize, waveSquads, tickArtLock } from '../hub.js';

const W = () => CAV.soldier.war;
const TANKS = new Set(['grunt', 'heavy', 'shield', 'chief', 'sniper', 'pyro']);
const ZONES = [], SEEN = new WeakSet(); let _said = -1e9;
// the wave: mostly men; the tank comes last, as a set piece
export function soldierWaveQueue(stage, wave){ const C = W(), w = C.w, n = Math.max(3, Math.round(waveSize(stage, wave) * C.sizeK));
  const pool = [['rifle', w.rifle], ['rpg', w.rpg + stage * 0.3], ['scout', w.scout + wave * 0.15]];
  if(stage >= 2 || wave >= 3) pool.push(['carrier', w.carrier + (stage - 1) * 0.2]);
  if(stage >= 2) pool.push(['mortar', w.mortar + (stage - 2) * 0.15]);
  if(stage >= 3) pool.push(['heliTroop', w.heli + (stage - 3) * 0.15]);
  const tot = pool.reduce((s, q) => s + q[1], 0), q = [];
  for(let i = 0; i < n; i++){ let r = Math.random() * tot, t = 'rifle'; for(const [ty, k] of pool){ if((r -= k) <= 0){ t = ty; break; } } q.push(t); }
  const ns = waveSquads(stage, wave) + C.squads; for(let k = 0; k < ns; k++) q.splice(1 + ((Math.random() * q.length) | 0), 0, 'squad');
  if(wave >= C.tankFrom || stage >= 2){ const nT = stage >= 4 && wave >= 4 ? 2 : 1; for(let k = 0; k < nT; k++) q.push(stage >= 4 ? 'heavy' : 'grunt'); }
  return q; }
// the tank's main gun against a man (combat AI asks this instead of firing a round): lay it on a spot, then fire
export function tankShellZone(e, aimA, d, dmg, heavy){ const C = W().shell, tx = e.pos.x + Math.sin(aimA) * d, tz = e.pos.z + Math.cos(aimA) * d, R = C.R * (heavy ? 1.25 : 1);
  ZONES.push({ e, tx, tz, R, dmg:dmg * C.dmgK, heavy, t:C.lock, state:'lay', zone:makeArtLock(tx, tz, R, R * 0.4) }); sfx('beep'); }
export function updateSoldierWar(dt, now){ announce(now); const C = W().shell;
  for(let i = ZONES.length - 1; i >= 0; i--){ const s = ZONES[i]; s.t -= dt; const u = s.zone.userData;
    if(s.state === 'lay'){ const k = 1 - Math.max(0, s.t) / C.lock; tickArtLock(s.zone, k, null, now, dt);   // Z318 the same battle-light pulse as a barrage ring, quickening as it settles
      u.shadow.scale.setScalar(0.5 + k * s.R * 0.5); u.shadow.material.opacity = 0.06 + 0.2 * k;   // it settles on the spot
      if(s.t <= 0){ fire(s); s.state = 'fly'; s.t = C.flight; } }
    else if(s.t > 0) tickArtLock(s.zone, 1, 1 - s.t / C.flight, now, dt);   // the shell is in the air: critical pulse, its shadow grows
    else { if(!s.dud) burst(s, now); disposeArtZone(s.zone); ZONES.splice(i, 1); } } }
export function clearSoldierWar(){ for(const s of ZONES) disposeArtZone(s.zone); ZONES.length = 0; }
function fire(s){ const e = s.e; if(!enemies.includes(e) || !(e.hp > 0)){ s.dud = true; return; }   // knocked out while it aimed: no shell
  const a = Math.atan2(s.tx - e.pos.x, s.tz - e.pos.z), y = heightAt(e.pos.x, e.pos.z) + 2.2, mx = e.pos.x + Math.sin(a) * 3, mz = e.pos.z + Math.cos(a) * 3, v = Math.hypot(s.tx - mx, s.tz - mz) / W().shell.flight;
  tankRecoil(e.mesh, a, s.heavy ? 0.95 : 0.6, e.facing); enemyMuzzleFX(mx, y, mz, a, s.heavy); sfx('enemyShoot', e.pos);
  spawnPart(mx, y, mz, Math.sin(a) * v, (heightAt(s.tx, s.tz) + 0.8 - y) / W().shell.flight, Math.cos(a) * v, { tex:'flash', color:0xffb050, size:0.7, life:W().shell.flight, grav:0, drag:0 }); }   // the shell streaking in
function burst(s, now){ const p = S.player; bigExplode({ x:s.tx, z:s.tz }, 0xffc070, s.heavy ? 0.85 : 0.65); sfx('boom', { x:s.tx, z:s.tz }, 0.8); blastAllies(s.tx, s.tz, s.R, s.dmg);
  if(!p) return; const dx = p.pos.x - s.tx, dz = p.pos.z - s.tz, d = Math.hypot(dx, dz); if(d < s.R) damagePlayer(s.dmg * (1 - 0.6 * d / s.R), now, dx || 0.01, dz); }
// a tank rolling in is news
function announce(now){ for(const e of enemies){ if(SEEN.has(e) || !TANKS.has(e.type) || e.def.inf || e.def.air) continue; SEEN.add(e);
    floatText('XE TĂNG ĐỊCH!', '#ff6a4a', e.pos, 22); if(now - _said > 20){ _said = now; sfx('alarm'); radio('SCH: Xe tăng địch! Thấy vòng đỏ là chạy khỏi nó — nấp sau công sự, ném lựu đạn hoặc gọi không kích.'); } } }
