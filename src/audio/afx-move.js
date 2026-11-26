// audio/afx-move.js — AUDIO 2 MEN ON THE MOVE: a footstep by the ground under it (sand hisses, rock scrapes, the shallows splash, snow crunches, steel rings, grass swishes) and by the gait (heavier and with the kit rattling at a run, soft at a crouch, a drag at a crawl) — the player's at the instant each foot comes down (actors/soldier-legs.js), the men within AUDIOFX.step.R of him on their own cadence; the breath knocked out landing a jump; a horse's hooves by the ground
//   Nothing here is told to the enemy: ai/awareness.js already hears only a standing run, hooves and an engine (PL.st, PL.v) — there is no hook to feed, and none was added.
import { AUDIOFX } from '../../config.js';
import { AFX, CV, FT, MOBILE, S, UGRID, actx, afxGait, afxGruntBuf, afxKey, afxKitBuf, afxOn, afxPlay, afxPoolCount, afxStepBuf, afxStepCad, afxSurfaceAt, unitsNear } from '../hub.js';

const A = AUDIOFX, _p = { x:0, z:0 }, _near = [];
const mkStep = (sr, r, surf, heavy) => afxStepBuf(sr, surf, r, heavy), mkKit = (sr, r) => afxKitBuf(sr, r), mkGrunt = (sr, r) => afxGruntBuf(sr, r);
export const AFXM = { footAt:-9, ph:0, n:0, hoofAt:-9, steps:0, others:0 };
// one footfall at (x, z): own = the player's (the others' are quieter, and only while the pool has room for them)
function step(x, z, gait, own, k){ const C = A.step, G = C.gait[gait] || C.gait.run, surf = afxSurfaceAt(x, z); _p.x = x; _p.z = z;
  if(!afxPlay(afxKey('step', surf), mkStep, surf, false, _p, 'foley', A.prio.foley, (own ? C.own : C.own * C.npc) * G.g * (C.surf[surf] || 1) * (k || 1) * (0.85 + Math.random() * 0.3), G.rate * (0.94 + Math.random() * 0.12), 0)) return;
  if(own){ AFXM.steps++; const K = C.kit, ch = gait === 'sprint' ? K.sprint : gait === 'run' ? K.run : 0;                    // his kit: every stride at a sprint, now and then at a run
    if(ch > 0 && Math.random() < ch) afxPlay('kit', mkKit, 0, 0, _p, 'foley', A.prio.foley, K.g * (0.8 + Math.random() * 0.4), 0.9 + Math.random() * 0.2, K.at); }
  else AFXM.others++; }
// the player's foot has come down (actors/soldier-legs.js, the swing's end): P = whose legs, v = his speed
export function afxFoot(P, x, z, v){ if(P !== S.player || !afxOn() || CV.mounted) return; AFXM.footAt = AFX.now; step(x, z, afxGait(CV.stance, v, A.step), true, 1); }
// he lands a jump (game/soldier-moves.js): both boots, and the breath out of him
export function afxLand(pos){ if(!afxOn() || !pos) return; const C = A.step.land; step(pos.x, pos.z, 'sprint', true, C.step); _p.x = pos.x; _p.z = pos.z;
  afxPlay('grunt', mkGrunt, 0, 0, _p, 'foley', A.prio.squad, C.grunt, 0.92 + Math.random() * 0.16, C.at); }
// a hoof comes down (game/cavalry.js hoofFall): false = not played here (no context yet: the old thump plays)
export function afxHoof(x, z, v){ if(!afxOn()) return false; const C = A.step.hoof; if(AFX.now - AFXM.hoofAt < C.gap) return AFX.ready; AFXM.hoofAt = AFX.now; _p.x = x; _p.z = z; const surf = afxSurfaceAt(x, z);
  return afxPlay(afxKey('hoof', surf), mkStep, surf, true, _p, 'foley', A.prio.foley, C.g * (C.slow + (1 - C.slow) * Math.min(1, v / C.fullV)) * (A.step.surf[surf] || 1), C.rate[0] + Math.random() * (C.rate[1] - C.rate[0]), 0); }
// a man near the player, each frame: his speed from where he was, his own cadence
function man(m, dt, px, pz, r2, t){ const C = A.step, x = m.pos.x, z = m.pos.z, dx = x - px, dz = z - pz; if(dx * dx + dz * dz > r2 || m.dead){ m._fx = undefined; return; }
  if(m._fx === undefined){ m._fx = x; m._fz = z; m._fp = Math.random(); return; }
  const v = Math.hypot(x - m._fx, z - m._fz) / dt; m._fx = x; m._fz = z; if(v > C.maxV) return;                               // (he was moved, not walking)
  m._fp += afxStepCad(v, false, C) * dt; if(m._fp < 1) return; m._fp -= Math.floor(m._fp);
  if(afxPoolCount(AFX.pool, 'foley', t) < (MOBILE ? C.maxPhone : C.max)) step(x, z, v >= C.runV ? 'run' : 'walk', false, 1); }
// once a frame from audio/afx.js updateAfx
export function updateAfxMove(dt, now){ const p = S.player, C = A.step; if(!p || !p.pos || S.mode !== 'playing' || !(dt > 0)) return; const t = actx.currentTime;
  if(!CV.mounted && !CV.jump && !CV.roll && p.vel){ const v = Math.hypot(p.vel.x, p.vel.z), crawl = CV.stance === 'prone';           // on his feet with no foot-plant coming (no rig yet, or flat on his belly): by cadence
    if(crawl || now - AFXM.footAt > C.fallback){ AFXM.ph += afxStepCad(v, crawl, C) * dt; if(AFXM.ph >= 1){ AFXM.ph -= Math.floor(AFXM.ph); step(p.pos.x, p.pos.z, afxGait(CV.stance, v, C), true, 1); } } else AFXM.ph = 0.5; }
  const r2 = C.R * C.R, L = unitsNear(UGRID.inf, p.pos.x, p.pos.z, C.R, _near); for(let i = 0; i < L.length; i++) man(L[i], dt, p.pos.x, p.pos.z, r2, t);
  for(let i = 0; i < FT.length; i++) man(FT[i], dt, p.pos.x, p.pos.z, r2, t); }
