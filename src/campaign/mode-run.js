// campaign/mode-run.js — MODE 3 THE RUN KIT of the two extra modes (night defence: campaign/night-defence.js · the daily challenge: campaign/daily.js).
//   A mode is a CUSTOM battle (S.run.mode === 'custom': the campaign's save, its ladder and its checkpoint are never written — core/profile.js saveProgress,
//   ui/battle-setup.js campaignCleared, campaign/nemesis.js) carrying one more field (run.nd / run.daily) and run.offBoard (core/score-report.js sends nothing).
//   This module is the only place the game's flow knows about modes — five one-line calls:
//     game/flow.js startGame → modeBegin(run) once the run is known (whatever the last mode left is put back first, then the new one turns its knobs) and
//       modeReady() when the soldier stands ready (his guns, his lives, his skills) · quitToMenu → modeQuit() · pauseWhere → modePauseTx()
//     game/loop.js → updateModes(dt, now) every frame of play (the first one is the moment the fight went live)
//     game/player-damage.js gameOver → modeOver(reason): the mode's own result card instead of the campaign's (no record, no report)
//     campaign/boss.js startBoss → modeBossHold() · bossStageWon → modeStageWon(): the stage's general falling ends a mode's battle, never opens the next stage
//     ui/briefing.js openBriefing → modeBrief(): the mode's rules where the stage's story was
//   NO TRACE: everything a mode changes goes through modeKnob / modeSet (a config number, put back) or modeUndo (anything else: a skill added to the wheel, a
//   pickup's effect, Math.random, a HUD piece) and is undone by modeEnd() — on a restart, on quitting to the menu, before the next battle of any kind. A mode's
//   clocks count the frames' own dt (a pause stops them); a delayed line is a frame count too (modeSay), never a timer. The campaign director's memory of deaths
//   (PROFILE.dirEase) is parked in PROFILE.modes.hold for the run and put back — at the next page load if the tab was closed in the middle of one.
import { DIRECTOR, DRONEWAR, LOGISTICS, SIDEMISSION } from '../../config.js';
import { BIOME, DIFF_META, PROFILE, S, SHOTS, TOD_LABEL, biomeVi, capVi, hide, knobApply, knobRefs, launchGame, modeClockTx, quitToMenu, radio, saveProfile, sfx, show, tapBtn } from '../hub.js';

const KNOBS = { DIRECTOR, DRONEWAR, LOGISTICS, SIDEMISSION };   // the config objects a modifier's `set` may name (test.js holds DAILY.mods to this list)
const DEFS = {};                                                // id → the mode's handlers (modeDefine)
export const MODE = { id:'', H:null, cfg:null, seq:0, live:false, over:false, t:0, knobs:[], undo:[], sayQ:[], card:null };
export function modeDefine(id, handlers){ DEFS[id] = handlers; }
export function modeOn(id){ return id ? MODE.id === id : !!MODE.id; }
export const fillTx = (t, o) => String(t ?? '').replace(/\{(\w+)\}/g, (m, k) => o && o[k] != null ? o[k] : '');
export const pickTx = L => Array.isArray(L) ? L[(Math.random() * L.length) | 0] : L;
export const lowVi = t => String(t || '').toLocaleLowerCase('vi');

// ---- what a mode changes, and how it is put back ----
export function modeKnob(o, k, v){ MODE.knobs.push([o, k, o[k]]); o[k] = v; }
export function modeSet(path, op, x){ const R = knobRefs(KNOBS, path); for(let i = 0; i < R.length; i++) modeKnob(R[i][0], R[i][1], knobApply(R[i][0][R[i][1]], op, x)); return R.length; }
export function modeUndo(fn){ MODE.undo.push(fn); }
// the profile's own corner for the modes: { nd:{ nights, score }, daily:{ hist:[…], cur:{ d } }, hold:{ dirEase } }
export function modeStore(){ let m = PROFILE.modes; if(!m || typeof m !== 'object') m = PROFILE.modes = {};
  if(!m.nd || typeof m.nd !== 'object') m.nd = { nights:0, score:0 }; if(!m.daily || typeof m.daily !== 'object') m.daily = { hist:[], cur:null }; if(!Array.isArray(m.daily.hist)) m.daily.hist = []; return m; }
function holdBack(){ const m = PROFILE.modes; if(!m || !m.hold) return; PROFILE.dirEase = m.hold.dirEase || null; delete m.hold; saveProfile(true); }
holdBack();   // a run the tab was closed on: the campaign's director gets its memory back before anything is played

// ---- the flow's calls ----
// a battle begins (game/flow.js startGame, the run known, the world not yet built): the last mode's traces go, this run's mode — if it is one — turns its knobs
export function modeBegin(run){ modeEnd(); const id = run && run.mode === 'custom' ? (run.nd ? 'nd' : run.daily ? 'daily' : '') : ''; if(!id || !DEFS[id]) return;
  Object.assign(MODE, { id, H:DEFS[id], cfg:run, live:false, over:false, t:0 }); MODE.seq++;
  modeStore().hold = { dirEase:PROFILE.dirEase || null }; PROFILE.dirEase = null; saveProfile(true);   // the same director for everyone; the campaign's own easing waits outside
  S.kills = 0; SHOTS.n = SHOTS.hit = 0;
  MODE.H.begin && MODE.H.begin(run); }
// the soldier stands ready, the battlefield is built (startGame, just before the intro)
export function modeReady(){ if(MODE.id && MODE.H.ready) MODE.H.ready(S.player); }
// every frame of play, after the waves (game/loop.js): the first one is the fight going live
export function updateModes(dt, now){ if(!MODE.id || MODE.over) return;
  if(!MODE.live){ MODE.live = true; MODE.t = 0; S.kills = 0; SHOTS.n = SHOTS.hit = 0; MODE.H.live && MODE.H.live(now); }
  MODE.t += dt;
  for(let i = MODE.sayQ.length - 1; i >= 0; i--){ const q = MODE.sayQ[i]; if((q.t -= dt) <= 0){ MODE.sayQ.splice(i, 1); radio(q.msg); } }
  MODE.H.frame && MODE.H.frame(dt, now); }
// a radio line `wait` s of play from now (0: at once)
export function modeSay(msg, wait){ if(!msg) return; if(!(wait > 0)) radio(msg); else MODE.sayQ.push({ t:wait, msg }); }
// the battle is lost (game/player-damage.js gameOver): the mode's own ending. true: the campaign's game-over screen, record and report are not for this run
export function modeOver(reason){ if(!MODE.id) return false; if(MODE.over) return true; MODE.H.over && MODE.H.over(reason); return true; }
// the stage's general fell in his citadel (campaign/boss.js bossStageWon). true: no next stage, no campaign progress — the mode decides what it means
export function modeStageWon(now, bdef){ if(!MODE.id) return false; if(!MODE.over && MODE.H.stageWon) MODE.H.stageWon(now, bdef); return true; }
// may the citadel's general take the field on his own (campaign/boss.js startBoss)? a mode can keep him for itself
export function modeBossHold(){ return !!(MODE.id && MODE.H.bossHold && MODE.H.bossHold()); }
// the pause screen's line (game/flow.js pauseWhere): '' = the campaign's own
export function modePauseTx(){ return MODE.id && MODE.H.pauseTx ? MODE.H.pauseTx() : ''; }
// the briefing's operation, story and objective (ui/briefing.js openBriefing, after it has written the stage's)
export function modeBrief(){ if(!MODE.id || !MODE.H.brief) return; const B = MODE.H.brief(), put = (id, f) => { const e = document.getElementById(id); if(e) f(e); }; if(!B) return;
  put('br-op', e => { e.textContent = B.op; }); put('br-brief', e => { e.replaceChildren(B.brief); });
  put('br-obj', e => { const b = document.createElement('b'), s = document.createElement('span'); b.textContent = 'Mục tiêu'; s.textContent = B.obj; e.replaceChildren(b, s); }); }
// nothing of a mode is left: its knobs back (last turned, first back), its undo list run, its HUD pieces and its result card away
export function modeEnd(){ const was = MODE.id; MODE.id = ''; MODE.live = false; MODE.over = false; MODE.sayQ.length = 0; MODE.seq++;
  if(was && MODE.H && MODE.H.end){ try{ MODE.H.end(); }catch(e){ console.error('mode end', e); } }
  for(let i = MODE.undo.length - 1; i >= 0; i--){ try{ MODE.undo[i](); }catch(e){ console.error('mode undo', e); } } MODE.undo.length = 0;
  for(let i = MODE.knobs.length - 1; i >= 0; i--){ const q = MODE.knobs[i]; q[0][q[1]] = q[2]; } MODE.knobs.length = 0;
  modeChip(null); MODE.card = null; MODE.H = null; MODE.cfg = null; holdBack();
  { const e = typeof document !== 'undefined' && document.getElementById('modeEnd'); if(e && !e.classList.contains('hidden')) hide('modeEnd'); } }
// back to the home menu (game/flow.js quitToMenu)
export function modeQuit(){ modeEnd(); }

// ---- what both modes show ----
// the run's numbers so far: enemies down (everyone's kills), his own accuracy (trigger pulls that struck / pulls), seconds of play
export function modeStats(){ const n = SHOTS.n | 0, hit = Math.min(n, SHOTS.hit | 0); return { kills:S.kills | 0, shots:n, hits:hit, acc:n >= 1 ? hit / n : 0, secs:MODE.t }; }
export function modeWhere(){ return { b:capVi(biomeVi(BIOME.name)), tod:lowVi(TOD_LABEL[S.tod] || ''), diff:capVi((DIFF_META[PROFILE.difficulty] || DIFF_META.soldier).label), name:PROFILE.nickname || '' }; }
// THE HUD: text in the side mission's card (index.html #sideChip — a mode that uses it keeps the side missions off): a name, a clock, a bar 0…1, a line
let _chip = null, _sig = '';
export function modeChip(name, clock, k, line, cls){ if(typeof document === 'undefined') return; if(!_chip){ const el = document.getElementById('sideChip'); if(!el) return; _chip = { el, name:el.querySelector('.sc-name'), t:el.querySelector('.sc-t'), bar:el.querySelector('.sc-bar i'), fx:el.querySelector('.sc-fx') }; }
  if(name == null){ if(_sig){ _sig = ''; _chip.el.classList.add('hidden'); _chip.el.classList.remove('done', 'fail'); } return; }
  const sig = name + '|' + clock + '|' + Math.round(k * 100) + '|' + line + '|' + (cls || ''); if(sig === _sig) return; _sig = sig;
  _chip.el.classList.remove('hidden'); _chip.el.classList.toggle('done', cls === 'done'); _chip.el.classList.toggle('fail', cls === 'fail');
  _chip.name.textContent = name; _chip.t.textContent = clock; _chip.bar.style.width = Math.round(Math.max(0, Math.min(1, k)) * 100) + '%'; _chip.fx.textContent = line; }
// THE RESULT CARD (index.html #modeEnd, the design system's end screen): o = { kick, lost, big, why (HTML of the mode's own making), stats:[[label, value], …],
//   best, newBest, hint, go (the main button's label), onGo, share (the text COPY RESULT puts on the clipboard), copy:{ label, done, fail } }. The battle is over.
export function modeCard(o){ MODE.over = true; MODE.card = o; S.mode = 'gameover'; S.firing = false; document.body.classList.remove('corelow', 'coreatk', 'coredanger'); modeChip(null);
  const put = (id, f) => { const e = document.getElementById(id); if(e) f(e); };
  put('meKick', e => { e.textContent = o.kick || ''; e.classList.toggle('xk-lost', !!o.lost); }); put('meBig', e => { e.textContent = o.big || ''; }); put('meWhy', e => { e.innerHTML = o.why || ''; });
  put('meStats', e => { e.replaceChildren(); for(const [l, v] of o.stats || []){ const d = document.createElement('div'), a = document.createElement('div'), b = document.createElement('div'); d.className = 'go-stat'; a.className = 'l'; b.className = 'v'; a.textContent = l; b.textContent = v; d.append(a, b); e.appendChild(d); } });
  put('meBest', e => { e.textContent = o.best || ''; e.classList.toggle('newbest', !!o.newBest); }); put('meHint', e => { e.textContent = o.hint || ''; });
  put('meGoT', e => { e.textContent = o.go || ''; }); put('meCopyT', e => { e.textContent = (o.copy && o.copy.label) || ''; }); put('meCopy', e => { e.style.display = o.share ? '' : 'none'; });
  show('modeEnd'); sfx(o.lost ? 'alarm' : 'levelup'); }
// COPY RESULT: the text to the clipboard (the async API where the page may use it, else a hidden field and the old command); the button says what happened
function copyText(t){ const old = () => { try{ const a = document.createElement('textarea'); a.value = t; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;left:-99px;top:0;opacity:0'; document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return !!ok; }catch(e){ return false; } };
  try{ if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(() => true, () => old()); }catch(e){} return Promise.resolve(old()); }
function cardCopy(){ const o = MODE.card, el = document.getElementById('meCopyT'); if(!o || !o.share || !el) return; const C = o.copy || {}, k = MODE.seq;
  copyText(o.share).then(ok => { if(MODE.seq !== k) return; el.textContent = ok ? C.done : C.fail; setTimeout(() => { if(MODE.seq === k && MODE.card === o) el.textContent = C.label; }, 2200); }); sfx('click'); }
function cardGo(){ const o = MODE.card; if(o && o.onGo) o.onGo(); }
if(typeof document !== 'undefined'){ tapBtn('meHome', quitToMenu); tapBtn('meGo', cardGo); tapBtn('meCopy', cardCopy); }
// a mode's battle from a menu: the same veil and build as any other (game/flow.js launchGame); from the home screen its briefing's back button goes home
export function modeLaunch(cfg, fromHome){ launchGame({ mode:'custom', offBoard:true, ...cfg }); if(fromHome) S.launchFrom = 'home'; }
export const modeNum = n => Math.round(n || 0).toLocaleString('vi-VN'), modeTime = s => modeClockTx(s);
