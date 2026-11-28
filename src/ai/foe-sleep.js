// ai/foe-sleep.js — PERF 2 THE ACTIVE-ENEMY BUDGET (C1-024): a fort's garrison, its camps, its towers and the waves together put 90–130 men on a field, and every
//   one of them thought, moved, aimed and was posed every frame. Now only the nearest MIXER.budget[device].activeFoes are awake, plus anyone inside sleepR m
//   of the soldier, plus anyone hurt: past both, a man SLEEPS — no thinking, no steps, no shots, his pose held (he is a few pixels in the haze there). The list
//   is ranked again every `every` s, so as the near ones fall the next ones wake and come on: the same men, the same pacing, never more than the budget at
//   once out where nobody can see them. Bosses, generals, escorts and men in a scripted move (climbing out, fleeing, giving up, filing out of a gate)
//   never sleep. ?nosleep turns it off (to compare).
import { MIXER } from '../../config.js';
import { MOBILE, S, enemies } from '../hub.js';

const OFF = typeof location !== 'undefined' && /[?&]nosleep\b/.test(location.search), EVERY = 0.5;
export const FSLEEP = { asleep:0, awake:0, at:0 };
const R = [], D = new Float64Array(512), byD = (a, b) => D[a] - D[b];
const never = e => !e.def.inf || (e.guard && e.guard.kind === 'escort') || e.general || e.fortBoss || e.held || e.rise || e.nemFlee || e.gaveUp || e.exit || e.hp < e.maxHp - 0.5;   // (a garrison holding its post sleeps like the rest; an escort walks with its commander)
// every frame of play (ai/tactics.js updateEnemies, before the men move): re-rank now and then
export function foeSleepTick(now){ if(now < FSLEEP.at) return; FSLEEP.at = now + EVERY; const p = S.player, B = MIXER.budget[MOBILE ? 'phone' : 'desktop'], N = Math.min(enemies.length, D.length);
  if(OFF || !p || !B || !(B.activeFoes > 0)){ for(const e of enemies) e.zz = false; FSLEEP.asleep = 0; FSLEEP.awake = enemies.length; return; }
  R.length = 0; for(let i = 0; i < N; i++){ const e = enemies[i], dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z; D[i] = dx * dx + dz * dz; R.push(i); }
  R.sort(byD); const r2 = B.sleepR * B.sleepR; let z = 0;
  for(let k = 0; k < R.length; k++){ const e = enemies[R[k]], s = k >= B.activeFoes && D[R[k]] > r2 && !never(e); e.zz = s; if(s) z++; }
  for(let i = N; i < enemies.length; i++) enemies[i].zz = false;
  FSLEEP.asleep = z; FSLEEP.awake = enemies.length - z; }
// asleep this frame (a hurt man, or one the soldier has come within sleepR of, wakes at once, not at the next ranking)
export function foeAsleep(e){ if(!e.zz) return false; const p = S.player, B = MIXER.budget[MOBILE ? 'phone' : 'desktop'];
  if(e.hp < e.maxHp - 0.5 || !p || !B || (e.pos.x - p.pos.x) ** 2 + (e.pos.z - p.pos.z) ** 2 < B.sleepR * B.sleepR){ e.zz = false; return false; } return true; }   // (a man back from a tunnel, or the soldier come close)
