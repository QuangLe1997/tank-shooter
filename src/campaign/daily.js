// campaign/daily.js — MODE 2 THE DAILY CHALLENGE ("THỬ THÁCH HÔM NAY", config DAILY; the run kit: campaign/mode-run.js; the generator: data/mode-math.js).
//   One battle a day, the same for everyone: from the calendar day in UTC+7 alone come the battlefield, the hour, the weather, the enemy level, the seed the
//   battlefield is built from (Math.random is that seed's generator for the run, as ?seed=N does for a test — boot/safety.js — and the page's own comes back with
//   the mode), ONE MODIFIER and the gun he is issued. It is a custom battle of one campaign stage: the stage's general falling completes it, the Core lost or the
//   last life spent ends it. A modifier changes the day through what the game already has — config numbers (modeSet, put back with the mode), the guns in his
//   hands, his lives, the hour and the weather, a skill taken out of the wheel, a pickup that does nothing, the general taking the field at once, a big event
//   forced on a clock (DAILY.mods). The first attempt of the day that goes live is THE SCORED ONE (spent at that moment: closing the tab does not give it back);
//   every attempt after it is practice and says so — on the briefing, the banner, the pause screen, the result card, the copied text. The result card (the design
//   system's end screen, #modeEnd) has COPY RESULT: a short block of text, no link, nothing of the player's but his nickname. The day's scored result is kept in
//   PROFILE.modes.daily.hist (the last DAILY.keep days); the home screen shows today's challenge and whether it is done. The board is local: what a shared one
//   would need from the server is written at config DAILY.
import { DAILY, WEATHER } from '../../config.js';
import { BIOMES, GUNS, MODE, POWERUPS, S, TOD_LABEL, TROOPER_SPELLS, askConfirm, bigEventStart, biomeVi, capVi, celebrate, dailyChallenge, dailyDate, dailyDay, dailyKeep, dailyScore, fillTx, floatText, fortBossDown, lowVi, magCap, modeCard, modeDefine, modeLaunch, modeNum, modeRng, modeSay, modeSet, modeShare, modeStats, modeStore, modeTime, modeUndo, modeWhere, saveProfile, sfx, showBanner, startBoss, tapBtn, updateGunHUD, updateHUD, updateSpellHUD } from '../hub.js';

const D = DAILY, Y = D.say;
// the attempt in hand (dev / probes read it): ch — the day's challenge · mod — its modifier · scored — this is the day's one scored attempt
export const DC = { day:0, ch:null, mod:null, scored:false, live:false, kept:false, done:false, won:false, doneT:0, evT:0, gunAt:0, hunted:false, stats:{ events:0, stripped:0, knobs:0 } };
const today = () => dailyDay(Date.now(), D.tz), modOf = ch => D.mods.find(m => m.id === ch.mod) || D.mods[0];
// the profile's record: hist — one scored result a day, the newest first · cur { d } — the scored attempt being played. One left over from an earlier day (the
//   tab was closed on it) is entered as that day's result: spent, nothing scored
function book(){ const M = modeStore().daily, t = today(); if(M.cur && !(M.cur.d >= t)){ if(Number.isFinite(M.cur.d)) M.hist = dailyKeep(M.hist, { d:M.cur.d, s:0, t:0, k:0, a:0, w:0, x:1 }, D.keep); M.cur = null; }
  M.hist = M.hist.filter(e => e && Number.isFinite(e.d) && e.d > t - D.keep && e.d <= t); return M; }
const entryOf = (M, d) => M.hist.find(e => e.d === d) || (M.cur && M.cur.d === d ? { d, s:0, x:1 } : null);
// the words a challenge is told in
function desc(ch, mod){ return { date:dailyDate(ch.day).vi, b:capVi(biomeVi(ch.biome)), tod:lowVi(TOD_LABEL[ch.tod]), wx:lowVi((WEATHER[ch.wx] || WEATHER.clear).vi), lvl:ch.level, m:mod.vi, ds:mod.ds, guns:ch.guns.map(id => GUNS[id] ? GUNS[id].name : id).join(' + ') }; }

// ---- the home screen (ui/menus.js refreshStartUI): today's challenge and whether it is done; the button asks, then goes in ----
export function dailyHome(){ if(typeof document === 'undefined') return; const t = today(), ch = dailyChallenge(t, D), M = book(), e = entryOf(M, t), s = modeNum(e ? e.s : 0);
  const bt = document.getElementById('dailyBtnT'), ln = document.getElementById('dailyLine');
  if(bt) bt.textContent = e ? fillTx(Y.homeDone, { s }) : Y.name;
  if(ln) ln.textContent = fillTx(Y.line, { b:capVi(biomeVi(ch.biome)), m:modOf(ch).vi }) + (e ? fillTx(Y.lineDone, { s }) : Y.lineOpen); }
export function dailyLaunch(day){ const ch = dailyChallenge(day, D); modeLaunch({ level:ch.level, biome:Math.max(0, BIOMES.findIndex(b => b.name === ch.biome)), tod:ch.tod, wx:ch.wx, space:ch.space, daily:{ day } }, true); }
export function dailyOpen(){ const t = today(), ch = dailyChallenge(t, D), e = entryOf(book(), t), o = desc(ch, modOf(ch)); o.state = e ? fillTx(Y.ask.practice, { s:modeNum(e.s) }) : Y.ask.scored;
  askConfirm({ title:fillTx(Y.ask.title, o), body:fillTx(Y.ask.body, o), yes:e ? Y.ask.yesP : Y.ask.yes, no:Y.ask.no }, () => dailyLaunch(t)); }
if(typeof document !== 'undefined') tapBtn('dailyBtn', dailyOpen);

// a strict loadout (DAILY.mods[i].strict): whatever else he has picked up is put down again
function strict(){ const p = S.player, ok = DC.ch.guns; if(!p || !p.guns) return; let cut = false; for(let i = p.guns.length - 1; i >= 0; i--) if(!ok.includes(p.guns[i].id)){ p.guns.splice(i, 1); cut = true; }
  if(!cut) return; if(!p.guns.length) p.guns.push({ id:ok[0], ammo:magCap(GUNS[ok[0]]), rU:0, rD:0 }); p.gunIdx = Math.min(p.gunIdx, p.guns.length - 1); DC.stats.stripped++; floatText(Y.strict, '#ffd86a', p.pos, 15); updateGunHUD(); }
// the attempt's number; the scored one goes into the book (once)
function keep(won){ const st = modeStats(), score = dailyScore({ base:S.score, won, acc:st.acc, secs:st.secs }, D); if(!DC.scored || DC.kept) return score; DC.kept = true;
  const M = book(); M.hist = dailyKeep(M.hist, { d:DC.day, s:score, t:Math.round(st.secs), k:st.kills, a:Math.round(st.acc * 100), w:won ? 1 : 0, m:DC.mod.id }, D.keep); M.cur = null; saveProfile(); return score; }
function card(won, reason){ const st = modeStats(), W = modeWhere(), E = Y.end, o = desc(DC.ch, DC.mod), score = keep(won), M = book(), day = DC.day;
  const e = entryOf(M, day), top = M.hist.reduce((a, q) => Math.max(a, q.s | 0), 0);
  Object.assign(o, { res:won ? E.resWon : /MẠNG/.test(reason || '') ? E.resDead : E.resCore, score:modeNum(score), time:modeTime(st.secs), kills:st.kills, acc:Math.round(st.acc * 100), diff:W.diff, name:W.name, won, practice:!DC.scored });
  modeCard({ kick:fillTx(DC.scored ? E.kick : E.kickP, o), lost:!won, big:won ? E.won : E.lost, why:fillTx(E.why, o), stats:[[E.stats[0], o.score], [E.stats[1], o.time], [E.stats[2], String(o.kills)], [E.stats[3], o.acc + '%']],
    best:fillTx(DC.scored ? E.best : E.bestP, { s:modeNum(e ? e.s : 0) }) + (M.hist.length > 1 ? fillTx(E.hist, { n:M.hist.length, top:modeNum(top) }) : ''), newBest:DC.scored && won, hint:E.hint, go:E.go, onGo:() => dailyLaunch(day),
    share:modeShare(o, Y.share), copy:{ label:Y.copy, done:Y.copied, fail:Y.copyFail } }); }

// ---- the mode (campaign/mode-run.js calls these) ----
modeDefine('daily', {
  // the run is known, the world not yet built: the day's challenge, whether this attempt is the scored one, the seed, the modifier's knobs
  begin(run){ const t = today(), day = Number.isFinite(run.daily && run.daily.day) ? Math.floor(run.daily.day) : t, ch = dailyChallenge(day, D), mod = modOf(ch), M = book();
    Object.assign(DC, { day, ch, mod, scored:day === t && !entryOf(M, day), live:false, kept:false, done:false, won:false, doneT:0, evT:0, gunAt:0, hunted:false }); for(const k in DC.stats) DC.stats[k] = 0;
    const r0 = Math.random; Math.random = modeRng(ch.seed); modeUndo(() => { Math.random = r0; });   // the same battlefield for everyone today (the page's own generator comes back with the mode)
    for(const s of mod.set || []) DC.stats.knobs += modeSet(s[0], s[1], s[2]);
    for(const id of mod.spellsOff || []){ const i = TROOPER_SPELLS.findIndex(q => q.id === id); if(i < 0) continue; const sp = TROOPER_SPELLS.splice(i, 1)[0]; modeUndo(() => { TROOPER_SPELLS.splice(Math.min(i, TROOPER_SPELLS.length), 0, sp); updateSpellHUD(); }); }
    for(const id of mod.lootOff || []){ const u = POWERUPS.find(q => q.id === id); if(!u) continue; const f = u.apply; u.apply = () => { if(S.player) floatText(Y.noMed, '#ff9a8a', S.player.pos, 15); }; modeUndo(() => { u.apply = f; }); }
    const b = typeof document !== 'undefined' && document.getElementById('arsenalBtnP'); if(b){ const d0 = b.style.display; b.style.display = 'none'; modeUndo(() => { b.style.display = d0; }); } },   // (the pause screen's arsenal would swap the issued gun)
  // the soldier stands ready: the day's guns in his hands, full magazines; the lives the modifier leaves him
  ready(p){ if(!p) return; const g = DC.ch.guns.filter(id => GUNS[id]).map(id => ({ id, ammo:magCap(GUNS[id]), rU:0, rD:0 })); if(g.length){ p.guns = g; p.gunIdx = 0; }
    if(DC.mod.lives != null) p.lives = DC.mod.lives; S.spell = 0; updateSpellHUD(); updateGunHUD(); updateHUD(); },
  // the fight goes live: the scored attempt is spent now
  live(){ DC.live = true; if(DC.scored){ book().cur = { d:DC.day }; saveProfile(true); } showBanner(fillTx(DC.scored ? Y.go : Y.goP, { m:DC.mod.vi }), '#ffd86a'); },
  frame(dt, now){ const m = DC.mod; if(DC.done){ if((DC.doneT += dt) >= D.hold) card(true); return; }
    if(m.general && !DC.hunted && MODE.t >= D.hunterAt){ DC.hunted = true; startBoss(now); modeSay(Y.hunter, 5); }
    if(m.event && (DC.evT += dt) >= m.event.every){ if(bigEventStart(m.event.kind, now, true)){ DC.evT = 0; DC.stats.events++; } else DC.evT = m.event.every - m.event.retry; }
    if(m.strict && (DC.gunAt -= dt) <= 0){ DC.gunAt = D.strictTick; strict(); } },
  // the stage's general fell (campaign/boss.js bossStageWon gave it here): the challenge is done — his citadel falls, the men cheer, then the result
  stageWon(now, bdef){ const p = S.player; if(DC.done) return; DC.done = DC.won = true; DC.doneT = 0; S.awaitingUpgrade = true; S.wave = 0; if(p) p.invincibleUntil = now + D.hold + 3;
    showBanner(fillTx(Y.wonBanner, { g:bdef.name }), '#8cbf3f'); sfx('levelup'); fortBossDown(); celebrate('victory', 0, 0); updateHUD(); },
  over(reason){ if(!DC.done) card(false, reason); },   // (the general is down: nothing that lands afterwards takes the day back)
  pauseTx(){ return DC.ch ? fillTx(Y.pause, { date:dailyDate(DC.day).vi, m:DC.mod.vi, p:DC.scored ? '' : Y.pauseP }) : ''; },
  brief(){ const o = desc(DC.ch, DC.mod), e = entryOf(book(), DC.day); o.state = DC.scored ? Y.ask.scored : fillTx(Y.ask.practice, { s:modeNum(e ? e.s : 0) }); return { op:fillTx(Y.briefOp, o), brief:fillTx(Y.brief, o), obj:Y.obj }; },
  // the mode ends (a restart, the menu): a scored attempt left in the middle is entered as it stands — it was spent when the fight went live
  end(){ if(DC.scored && DC.live && !DC.kept) keep(false); DC.done = DC.live = false; } });
