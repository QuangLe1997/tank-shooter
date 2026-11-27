// data/knob-stack.js — MIX 1 THE ONE KNOB STACK (pure: no hub, no DOM — test.js and tools/spec.mjs load it in node).
//   Every number a battle turns away from config — a mode's (campaign/mode-run.js modeKnob / modeSet: night defence, the daily, a conquest fort's threat, the mixer),
//   a sector's (campaign/sectors.js sectorKnob: a hold sector's side-mission numbers, the route's consequences and event cards) — is one entry here:
//   [object, key, the value it had, scope]. Turned in order, put back last-first: knobBack('mode') at modeEnd, knobBack('sector') at every sector's start and at
//   sectorEnd — the same behaviour the two separate stacks had, now one list a probe can read (knobList) and the mixer can prove empty after a battle.
import { knobRefs, knobApply } from './mode-math.js';

export const KSTACK = [];
// o[k] = v, remembered under scope ('mode' · 'sector')
export function knobTurn(o, k, v, scope){ KSTACK.push([o, k, o[k], scope || 'mode']); o[k] = v; }
// a path under roots ('DIRECTOR.lull.t.*' — a last '*' = every numeric entry) turned by op ('*' · '+' · '='); the number of leaves turned
export function knobPath(roots, path, op, x, scope){ const R = knobRefs(roots, path); for(let i = 0; i < R.length; i++) knobTurn(R[i][0], R[i][1], knobApply(R[i][0][R[i][1]], op, x), scope); return R.length; }
// everything a scope turned goes back, last turned first (no scope: everything)
export function knobBack(scope){ for(let i = KSTACK.length - 1; i >= 0; i--){ const q = KSTACK[i]; if(scope && q[3] !== scope) continue; q[0][q[1]] = q[2]; KSTACK.splice(i, 1); } }
export function knobCount(scope){ let n = 0; for(const q of KSTACK) if(!scope || q[3] === scope) n++; return n; }
