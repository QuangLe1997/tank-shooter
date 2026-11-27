// campaign/mixer.js — MIX 1 composeBattle(spec): ONE BATTLE FROM A BattleSpec (the arithmetic: data/mixer-math.js · the numbers: config.js MIXER · the mapping:
//   tank-shooter-audit/mixer-mapping.md). The spec is normalized (clamped, cross-ruled, budgeted), scored, then fought as a MODE ('mix', campaign/mode-run.js) of a
//   custom, off-board battle: begin (the run known, nothing built) re-derives the plan on the pristine config and turns the BUILD leaves, declares the sector chain
//   (sectorBattle, its route / forks / event cards from the master seed) · seed(k) each build step on its own stream of the seed · ready: his lives · the first GO
//   (ui/briefing.js goLive → modeGo, before the director, surprises, side missions and big events read their numbers) turns the GO leaves and moves Math.random onto the
//   play stream · the general falling (or the last sector) is the battle's ONE win — no next stage · everything goes back at modeEnd (one knob stack, data/knob-stack.js).
//   MEASURED while it runs (MIX.meas): the director's pressure (mean / peak), damage he took, lives lost, kills, seconds — set beside the prediction in MIX.log.
//   MIX 3 the plan's steps are helpers another mode uses too (mixBegin / mixSeed / mixGo — the conquest's forts are specs now: campaign/conquest.js); { ladder:true }
//   is TỰ CHỌN itself (ui/battle-setup.js): the custom ladder on the board, stage after stage, the campaign's own game over; { desk:true } a battle from the mixer desk
//   (mixer.html): its card goes back to the desk, and every battle's prediction and measurement are kept in localStorage (xk.mixlog) for calibration.
//   Dev: ?spec=<name> (tools/specs/<name>.json) · ?spec=_session (the desk's spec in sessionStorage xk.mixspec) · ?mixspec=<url-encoded JSON> (dev/hooks.js).
//   Co-op: not supported yet (a guest would not hold the same knobs).
import { MIXER } from '../../config.js';
import { normalizeSpec, scoreBattle, mixRoots, mixRef, modeRng, modeHash, modeDefine, modeKnob, modeUndo, modeLaunch, modeCard, modeStats, modeSay, modeTime, modeNum, sectorBattle,
  coopActive, launchGame, modeEnd, sectorEnd, DIR, MOBILE, PROFILE, S, SECT, WAVE } from '../hub.js';

// spec = the normalized spec in hand · plan / score of the battle · meas = what the battle measured · log = the last battles (prediction beside measurement)
export const MIX = { spec:null, plan:null, score:null, clamped:[], warnings:[], meas:null, log:[], fromHome:false, desk:false, ladder:false };
export const MIX_LOG = 'xk.mixlog', MIX_SPEC = 'xk.mixspec';
const roots = () => mixRoots({ WAVE });
const opts = () => ({ roots:roots(), device:MOBILE ? 'phone' : 'desktop', diff:PROFILE.difficulty || 'soldier' });

// THE CORE CALL: spec → the battle. o: { fromHome, desk, ladder } (a bare true = fromHome, as before). Returns { ok, spec, plan, clamped, warnings, score } (ok false: refused — co-op)
export function composeBattle(spec, o){ o = o && typeof o === 'object' ? o : { fromHome:!!o }; if(coopActive()) return { ok:false, why:'co-op: the mixer is not carried to the guest yet' };
  sectorEnd(); modeEnd();   // a battle in hand (a RETRY from the card): its knobs back first, so the plan and the scores are read on the pristine config
  const op = opts(); if(!(spec && spec.seed != null)) op.seed = (Math.random() * 4294967296) >>> 0;   // (no seed: a new battle each time — the drawn one is in the plan)
  const n = normalizeSpec(spec, op), sc = scoreBattle(n);
  Object.assign(MIX, { spec:n.spec, plan:n.plan, score:sc, clamped:n.clamped, warnings:n.warnings, fromHome:!!o.fromHome, desk:!!o.desk, ladder:!!o.ladder && !n.spec.conq });
  const w = n.plan.world, run = { biome:w.biome, tod:w.tod, wx:w.wx, space:w.space, level:w.level, mix:{ seed:n.plan.seed } }; if(n.spec.conq) run.conq = { i:n.spec.conq.i };   // (a conquest fort: its own mode runs the plan)
  if(MIX.ladder) launchGame({ mode:'custom', ...run }); else modeLaunch(run, o.fromHome);   // TỰ CHỌN stays on the board (the leaderboard, the next stage); everything else is one battle off it
  return { ok:true, spec:n.spec, plan:n.plan, clamped:n.clamped, warnings:n.warnings, score:sc }; }
// the plan's leaves of one read time turned through the mode's knobs (put back by modeEnd)
function turn(plan, read){ const R = roots(); let n = 0; for(const q of plan.knobs){ if(q.read !== read) continue; const r = mixRef(R, q.path); if(!r) continue; modeKnob(r[0], r[1], q.to); n++; } return n; }

// ---- the plan's steps (the mix mode's and the conquest's) ----
// begin: the plan on the pristine config, Math.random on the build stream, the BUILD leaves, the sector chain (its win: onWon)
export function mixBegin(onWon){ const n = normalizeSpec(MIX.spec || { v:1, world:{ land:'DESERT' } }, opts()); MIX.plan = n.plan; const p = n.plan;
  const r0 = Math.random; Math.random = modeRng(p.seeds.build); modeUndo(() => { Math.random = r0; });   // seeded from here: the build step by step, then the play stream
  turn(p, 'build'); MIX.meas = { n:0, pSum:0, pPeak:0, dmg:0, lives:0, hp:-1, lv:-1, at:0 };
  if(p.structure.sectors) sectorBattle(p.structure.sectors, onWon, p.seeds.deal); return p; }
// a build step: its own stream — per stage and per sector, so a new stage / sector is a new field
export function mixSeed(k){ if(MIX.plan) Math.random = modeRng(modeHash(MIX.plan.seeds.build, k + 64 * ((S.stage | 0) + 8 * (SECT.on ? SECT.i | 0 : 0)))); }
// the battle's first GO: the GO leaves, Math.random on the play stream
export function mixGo(first){ if(!first || !MIX.plan) return; turn(MIX.plan, 'go'); Math.random = modeRng(MIX.plan.seeds.play); }
// every frame: what the battle measures
export function mixFrame(dt){ const m = MIX.meas, p = S.player; if(!m || !p) return;
  if(m.hp >= 0 && p.hp < m.hp && p.lives === m.lv) m.dmg += m.hp - p.hp; if(m.lv >= 0 && p.lives < m.lv) m.lives += m.lv - p.lives; m.hp = p.hp; m.lv = p.lives;
  if((m.at -= dt) <= 0){ m.at = 0.5; m.n++; m.pSum += DIR.P || 0; m.pPeak = Math.max(m.pPeak, DIR.P || 0); } }
// the battle's end: its measurement beside its prediction, kept (MIX.log + localStorage xk.mixlog, ≤ 30) — for the desk and for calibration
export function mixRecord(won){ const st = modeStats(), m = MIX.meas || {}, min = Math.max(1 / 60, st.secs / 60), sc = MIX.score || {};
  const meas = { won, secs:Math.round(st.secs), min:+(st.secs / 60).toFixed(2), kills:st.kills, kpm:+(st.kills / min).toFixed(2), acc:+st.acc.toFixed(2), pMean:m.n ? +(m.pSum / m.n).toFixed(3) : 0,
    pPeak:+(m.pPeak || 0).toFixed(3), dmg:Math.round(m.dmg || 0), dpm:+((m.dmg || 0) / min).toFixed(1), deaths:(m.lives || 0) + (won ? 0 : 1), sectors:SECT.stats ? SECT.stats.won : 0 };
  const e = { at:Date.now(), id:(MIX.spec && MIX.spec.id) || '', name:(MIX.spec && MIX.spec.name) || '', seed:MIX.plan ? MIX.plan.seed : 0, desk:MIX.desk,
    score:{ difficulty:sc.difficulty, intensity:sc.intensity, joy:sc.joy, appeal:sc.appeal, variety:sc.variety, fairness:sc.fairness, minutes:sc.minutes, kpm:sc.est && sc.est.kpm }, meas, spec:MIX.spec };
  MIX.log.push(e); if(MIX.log.length > 20) MIX.log.shift();
  try{ const L = JSON.parse(localStorage.getItem(MIX_LOG) || '[]'); L.push(e); while(L.length > 30) L.shift(); localStorage.setItem(MIX_LOG, JSON.stringify(L)); }catch(x){}
  return meas; }

function finish(won){ const st = modeStats(), meas = mixRecord(won), T = MIXER.say, sc = MIX.score || {};
  modeCard({ kick:T.kick, lost:!won, big:won ? T.won : T.lost, why:T.why.replace('{d}', sc.difficulty).replace('{m}', sc.minutes),
    stats:[[T.st.time, modeTime(st.secs)], [T.st.kills, modeNum(st.kills)], [T.st.acc, Math.round(st.acc * 100) + '%'], [T.st.dmg, modeNum(meas.dmg)]],
    go:MIX.desk ? T.desk : T.again, onGo:MIX.desk ? () => { location.href = 'mixer.html#log'; } : () => composeBattle(MIX.spec, { fromHome:MIX.fromHome }) }); }

modeDefine('mix', {
  keepEase(){ return MIX.ladder; },   // TỰ CHỌN: the campaign director's own memory, as the legacy launch had it
  begin(){ mixBegin(() => finish(true)); },   // the last sector won = the battle won
  seed(k){ mixSeed(k); },
  ready(p){ if(p && MIX.plan) p.lives = MIX.plan.player.lives; },
  go(now, first){ mixGo(first); },
  live(){ const sc = MIX.score; if(sc && !MIX.ladder) modeSay(MIXER.say.radio.replace('{d}', sc.difficulty).replace('{m}', sc.minutes), 0.5); },
  frame(dt){ mixFrame(dt); },
  stageWon(){ if(MIX.ladder){ mixRecord(true); return false; } finish(true); },   // TỰ CHỌN: the campaign's own stage won (perk, next stage, victory)
  over(){ if(MIX.ladder){ mixRecord(false); return false; } finish(false); },   // TỰ CHỌN: the campaign's own game over (RETRY replays S.runCfg → this spec again)
  brief(){ if(MIX.ladder) return null; const sc = MIX.score || {}, T = MIXER.say; return { op:(MIX.spec && MIX.spec.name) || T.op, brief:T.brief.replace('{d}', sc.difficulty).replace('{i}', sc.intensity).replace('{m}', sc.minutes), obj:MIX.plan && MIX.plan.structure.sectors ? T.objSect : T.obj }; },
  pauseTx(){ return MIX.ladder ? '' : MIXER.say.op; },
});
// dev / tools: the last battle's plan and numbers
export function mixState(){ return { spec:MIX.spec, plan:MIX.plan, score:MIX.score, meas:MIX.meas, log:MIX.log }; }
