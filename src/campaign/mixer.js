// campaign/mixer.js — MIX 1 composeBattle(spec): ONE BATTLE FROM A BattleSpec (the arithmetic: data/mixer-math.js · the numbers: config.js MIXER · the mapping:
//   tank-shooter-audit/mixer-mapping.md). The spec is normalized (clamped, cross-ruled, budgeted), scored, then fought as a MODE ('mix', campaign/mode-run.js) of a
//   custom, off-board battle: begin (the run known, nothing built) re-derives the plan on the pristine config and turns the BUILD leaves, declares the sector chain
//   (sectorBattle, its route / forks / event cards from the master seed) · seed(k) each build step on its own stream of the seed · ready: his lives · the first GO
//   (ui/briefing.js goLive → modeGo, before the director, surprises, side missions and big events read their numbers) turns the GO leaves and moves Math.random onto the
//   play stream · the general falling (or the last sector) is the battle's ONE win — no next stage · everything goes back at modeEnd (one knob stack, data/knob-stack.js).
//   MEASURED while it runs (MIX.meas): the director's pressure (mean / peak), damage he took, lives lost, kills, seconds — set beside the prediction in MIX.log.
//   Dev: ?spec=<name> loads tools/specs/<name>.json and composes it (dev/hooks.js). Co-op: not supported yet (a guest would not hold the same knobs).
import { MIXER } from '../../config.js';
import { normalizeSpec, scoreBattle, mixRoots, mixRef, modeRng, modeHash, modeDefine, modeKnob, modeUndo, modeLaunch, modeCard, modeStats, modeSay, modeTime, modeNum, sectorBattle,
  coopActive, modeEnd, sectorEnd, DIR, MOBILE, PROFILE, S, SECT, WAVE } from '../hub.js';

// spec = the normalized spec in hand · plan / score of the battle · meas = what the battle measured · log = the last battles (prediction beside measurement)
export const MIX = { spec:null, plan:null, score:null, clamped:[], warnings:[], meas:null, log:[], fromHome:false };
const roots = () => mixRoots({ WAVE });
const opts = () => ({ roots:roots(), device:MOBILE ? 'phone' : 'desktop', diff:PROFILE.difficulty || 'soldier' });

// THE CORE CALL: spec → the battle. Returns { ok, spec, plan, clamped, warnings, score } (ok false: refused — co-op)
export function composeBattle(spec, fromHome){ if(coopActive()) return { ok:false, why:'co-op: the mixer is not carried to the guest yet' };
  sectorEnd(); modeEnd();   // a battle in hand (a RETRY from the card): its knobs back first, so the plan and the scores are read on the pristine config
  const o = opts(); if(!(spec && spec.seed != null)) o.seed = (Math.random() * 4294967296) >>> 0;   // (no seed: a new battle each time — the drawn one is in the plan)
  const n = normalizeSpec(spec, o), sc = scoreBattle(n);
  Object.assign(MIX, { spec:n.spec, plan:n.plan, score:sc, clamped:n.clamped, warnings:n.warnings, fromHome:!!fromHome });
  const w = n.plan.world; modeLaunch({ biome:w.biome, tod:w.tod, wx:w.wx, space:w.space, level:w.level, mix:{ seed:n.plan.seed } }, fromHome);
  return { ok:true, spec:n.spec, plan:n.plan, clamped:n.clamped, warnings:n.warnings, score:sc }; }
// the plan's leaves of one read time turned through the mode's knobs (put back by modeEnd)
function turn(plan, read){ const R = roots(); let n = 0; for(const q of plan.knobs){ if(q.read !== read) continue; const r = mixRef(R, q.path); if(!r) continue; modeKnob(r[0], r[1], q.to); n++; } return n; }

function finish(won){ const st = modeStats(), m = MIX.meas || {}, min = Math.max(1 / 60, st.secs / 60);
  const meas = { won, secs:Math.round(st.secs), kills:st.kills, kpm:+(st.kills / min).toFixed(2), acc:+st.acc.toFixed(2), pMean:m.n ? +(m.pSum / m.n).toFixed(3) : 0, pPeak:+(m.pPeak || 0).toFixed(3),
    dmg:Math.round(m.dmg || 0), dpm:+((m.dmg || 0) / min).toFixed(1), livesLost:m.lives || 0, sectors:SECT.stats ? SECT.stats.won : 0 };
  MIX.log.push({ at:Date.now(), id:MIX.spec && MIX.spec.id || '', seed:MIX.plan.seed, score:MIX.score, meas }); if(MIX.log.length > 20) MIX.log.shift();
  const T = MIXER.say, sc = MIX.score || {};
  modeCard({ kick:T.kick, lost:!won, big:won ? T.won : T.lost, why:T.why.replace('{d}', sc.difficulty).replace('{m}', sc.minutes),
    stats:[[T.st.time, modeTime(st.secs)], [T.st.kills, modeNum(st.kills)], [T.st.acc, Math.round(st.acc * 100) + '%'], [T.st.dmg, modeNum(meas.dmg)]],
    go:T.again, onGo:() => composeBattle(MIX.spec, MIX.fromHome) }); }

modeDefine('mix', {
  begin(run){ const n = normalizeSpec(MIX.spec || { v:1, world:{ land:'DESERT' } }, opts()); MIX.plan = n.plan; const p = n.plan;   // (the config is pristine here: the last mode's and sectors' knobs went back)
    const r0 = Math.random; Math.random = modeRng(p.seeds.build); modeUndo(() => { Math.random = r0; });   // seeded from here: the build step by step, then the play stream
    turn(p, 'build'); MIX.meas = { n:0, pSum:0, pPeak:0, dmg:0, lives:0, hp:-1, lv:-1, at:0 };
    if(p.structure.sectors) sectorBattle(p.structure.sectors, () => finish(true), p.seeds.deal); },   // the last sector won = the battle won
  seed(k){ if(MIX.plan) Math.random = modeRng(modeHash(MIX.plan.seeds.build, k)); },
  ready(p){ if(p && MIX.plan) p.lives = MIX.plan.player.lives; },
  go(now, first){ if(!first || !MIX.plan) return; turn(MIX.plan, 'go'); Math.random = modeRng(MIX.plan.seeds.play); },
  live(){ const sc = MIX.score; if(sc) modeSay(MIXER.say.radio.replace('{d}', sc.difficulty).replace('{m}', sc.minutes), 0.5); },
  frame(dt, now){ const m = MIX.meas, p = S.player; if(!m || !p) return;
    if(m.hp >= 0 && p.hp < m.hp && p.lives === m.lv) m.dmg += m.hp - p.hp; if(m.lv >= 0 && p.lives < m.lv) m.lives += m.lv - p.lives; m.hp = p.hp; m.lv = p.lives;
    if((m.at -= dt) <= 0){ m.at = 0.5; m.n++; m.pSum += DIR.P || 0; m.pPeak = Math.max(m.pPeak, DIR.P || 0); } },
  stageWon(){ finish(true); },
  over(){ finish(false); },
  brief(){ const sc = MIX.score || {}, T = MIXER.say; return { op:(MIX.spec && MIX.spec.name) || T.op, brief:T.brief.replace('{d}', sc.difficulty).replace('{i}', sc.intensity).replace('{m}', sc.minutes), obj:MIX.plan && MIX.plan.structure.sectors ? T.objSect : T.obj }; },
  pauseTx(){ return MIXER.say.op; },
});
// dev / tools: the last battle's plan and numbers
export function mixState(){ return { spec:MIX.spec, plan:MIX.plan, score:MIX.score, meas:MIX.meas, log:MIX.log }; }
