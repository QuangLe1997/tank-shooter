// campaign/tyrant.js — SECTOR 6 BẠO CHÚA, THE LAST FORT'S GENERAL (config.js CONQSTORY.tyrant). He is the citadel's boss of campaign/fort-boss.js (its armour, its
//   sweep, its guards at 60 %, its rage at 30 %) with his own LOOK (a look of FORTBOSS.looks — `base`'s model — taller, his plate and glow, his name and gun line;
//   added here once as FORTBOSS.looks.tyrant, worn when CONQUEST's last fort names it) and health × hpK, and two things of his own, run by tyrantStep (fort-boss.js
//   step calls it each frame for a def marked tyrant):
//   · THE STEEL RAIN — from phase 2: a barrage of n shells round his man (the first on him, the rest within spread m), each warned by its blinking red ring
//     (campaign/surprises.js shells: the enemy's), every cd s — faster in his rage, fastest in his last stand;
//   · THE LAST STAND below `last` of his health: his name at the top band, a last word on the radio, lastGuards more men round him, his fire × lastFire.
//   Probes read TYR (the phases' times, the barrages, the guards).
import { CONQSTORY, FORTBOSS } from '../../config.js';
import { S, SURP, clampFieldXZ, radio, showBanner, sfx, spawnEnemy } from '../hub.js';

const T = CONQSTORY.tyrant;
// his look: the base look with his own height, plates, glow and words (made once)
if(T && FORTBOSS.looks[T.look.base] && !FORTBOSS.looks.tyrant){ const { base, ...own } = T.look; FORTBOSS.looks.tyrant = { ...FORTBOSS.looks[base], ...own }; }
export const TYR = { B:null, t0:0, ph:[], rains:0, shells:0, last:false, lastAt:0, guards:0, next:0 };
const idx = B => TYR.last ? 3 : Math.max(0, Math.min(2, B.phase - 1));
// the barrage: n shells, the first on the man, each landing gap s after the last, warned from the moment it is called
function rain(B, now){ const R = T.rain, p = S.player, n = R.n[idx(B)]; if(!p || !n) return;
  for(let k = 0; k < n; k++){ const a = Math.random() * 6.283, r = k ? Math.sqrt(Math.random()) * R.spread : 0, [x, z] = clampFieldXZ(p.pos.x + Math.cos(a) * r, p.pos.z + Math.sin(a) * r, 2);
    SURP.shells.push({ x, z, t:R.warn + k * R.gap, warn:R.warn, R:R.R, dmg:R.dmg, ours:false, pulse:0, wh:false }); }
  TYR.rains++; TYR.shells += n; showBanner(T.say.rain, '#ff4a3a'); radio(B.def.name + ': ' + T.say.rainR); sfx('alarm'); }
function lastStand(B, now){ const e = B.e, f = B.f; TYR.last = true; TYR.lastAt = now; TYR.ph.push({ p:4, t:+(now - TYR.t0).toFixed(1) });
  showBanner(T.say.last, '#ff3a2a'); radio(B.def.name + ': ' + T.say.lastR); sfx('horn', e.pos);
  for(let i = 0; i < T.lastGuards; i++){ const a = i / T.lastGuards * 6.283, [x, z] = clampFieldXZ(e.pos.x + Math.cos(a) * 5, e.pos.z + Math.sin(a) * 5, 4), g = spawnEnemy(i % 2 ? 'rpg' : 'rifle', x, z, 'door'); if(!g) continue;
    g.genGuard = true; g.fortOf = f; g.maxHp = g.hp = Math.round(g.maxHp * FORTBOSS.guards.hpK); g.loot = false; g.escA = a; g.escR = 4 + Math.random() * 3; g.guard = { kind:'escort', fort:f }; g.post = [x, z]; B.guards.push(g); TYR.guards++; }
  e.def = { ...e.def, fireCd:e.def.fireCd * T.lastFire }; TYR.next = Math.min(TYR.next, now + 2.5); }
// each frame of his fight (campaign/fort-boss.js step, a tyrant def)
export function tyrantStep(B, dt, now){ const e = B.e; if(!T || !e || B.st === 'dead') return;
  if(TYR.B !== B){ Object.assign(TYR, { B, t0:now, ph:[{ p:1, t:0 }], rains:0, shells:0, last:false, lastAt:0, guards:0, next:now + T.rain.first, seen:1 });
    e.maxHp = Math.round(e.maxHp * T.hpK); e.hp = e.maxHp; e.hitCap *= T.hpK; for(const k in B.plMax){ B.plMax[k] *= T.hpK; B.pl[k] *= T.hpK; } }
  if(B.phase !== TYR.seen){ TYR.seen = B.phase; TYR.ph.push({ p:B.phase, t:+(now - TYR.t0).toFixed(1) }); if(B.phase >= 2) TYR.next = Math.min(TYR.next, now + 3); }
  if(!TYR.last && e.hp / e.maxHp < T.last) lastStand(B, now);
  const cd = T.rain.cd[idx(B)]; if(cd && now >= TYR.next && B.st !== 'intro' && B.st !== 'pending' && B.st !== 'stagger'){ TYR.next = now + cd; rain(B, now); } }
// dev / probes: the fight in a line
export function tyrantState(){ const B = TYR.B; return B ? { phase:B.phase, last:TYR.last, ph:TYR.ph.slice(), rains:TYR.rains, shells:TYR.shells, guards:TYR.guards, hp:B.e ? Math.round(B.e.hp) : 0, maxHp:B.e ? Math.round(B.e.maxHp) : 0, st:B.st,
  look:B.def.lookId || '', name:B.def.name, h:B.look ? +(B.look.k || 0).toFixed(2) : 0, secs:B.tDown ? +(B.tDown - TYR.t0).toFixed(1) : null } : null; }
