// audio/afx-mix.js — AUDIO 3 THE MIXER, THE SCORE AND THE SQUAD'S CALLS: the music dips under gunfire and under a close blast and follows the battle's director (calm in a lull, driven at a peak, a held breath before the general comes) through one low-pass and one gain on what audio/music.js already plays; the fight dips a little under the radio; a blast within a few metres leaves him deaf for a moment (a low-pass on everything, a faint ringing — "Ù tai khi nổ gần" turns it off); a soft limiter ends the master chain; the squad calls out — reloading, grenade out, man down, target down, a flank — as text over the man who says it and a radio click
//   NO VOICE IS SYNTHESISED and no voice file is added: none of the recorded radio clips (assets/voice) says these words, so a call is its text + the click.
//   Everything here is wired in only while the layer is on (afxOn): off, the limiter goes straight to the output and the music straight to the master, as before.
import { AUDIOFX, STORY } from '../../config.js';
import { AFX, DIR, FT, LOUD, NADES, PROFILE, S, VOICE, actx, afxBarkOk, afxClipCurve, afxDeaf, afxDeafHold, afxDeafLp, afxDuckMusic, afxDuckWorld, afxFollow, afxMusic, afxOn, afxPlay, afxRR, afxSquelchBuf, duelOn, floatText, heightAt, limiter, master, musicBus, muted, radio, sfxLevel, squadList } from '../hub.js';

const A = AUDIOFX, mkSquelch = (sr, r) => afxSquelchBuf(sr, r), _bp = { x:0, y:0, z:0 };
// what the mixer holds (dev/probes read it): heat = the gunfire he hears, 0 … 1 · blast = a close blast's dip, fading · mus = what the director asks of the score
export const AFXX = { built:false, fail:false, wired:false, world:null, mLp:null, mDuck:null, mIn:null, dLp:null, pre:null, clip:null, heat:0, blast:0, at:0, barkAt:0, wT:1, mT:1, lT:0, ringUntil:0, deafs:0, said:0,
  mus:{ heat:0, lp:20000, gain:1 }, barks:{ at:-1e9, by:{} }, rr:{}, flank:null, rel:false };
function build(){ const a = actx, L = A.limit; AFXX.built = true;
  try{ const w = AFXX.world = a.createGain(); AFX.bus.disconnect(); AFX.bus.connect(w); w.connect(master);                // the world bus → its radio dip → the master (in for good: at 1 it is a wire)
    const ml = AFXX.mLp = a.createBiquadFilter(), md = AFXX.mDuck = a.createGain(); ml.type = 'lowpass'; ml.Q.value = 0.5; ml.frequency.value = A.music.open; ml.connect(md);
    const dl = AFXX.dLp = a.createBiquadFilter(), pre = AFXX.pre = a.createGain(), cl = AFXX.clip = a.createWaveShaper(); dl.type = 'lowpass'; dl.Q.value = 0.5; dl.frequency.value = A.deaf.lp[0];
    pre.gain.value = 1 / L.head; cl.curve = afxClipCurve(L.n, L.thr, L.top, L.head); dl.connect(pre); pre.connect(cl); }
  catch(e){ AFXX.fail = true; } }
// the music's own two nodes, in or out: musicBus → low-pass → duck → master (audio/engine-music.js makes musicBus when the music first starts)
function wireMusic(on){ if(!musicBus){ AFXX.mIn = null; return; }
  try{ musicBus.disconnect(); AFXX.mDuck.disconnect(); if(on){ musicBus.connect(AFXX.mLp); AFXX.mDuck.connect(master); } else musicBus.connect(master); AFXX.mIn = on ? musicBus : null; }catch(e){} }
// the master's end, in or out: limiter → [the deafened low-pass → the soft limiter] → the output
function wire(on){ const a = actx; AFXX.wired = on;
  try{ if(limiter){ limiter.disconnect(); AFXX.clip.disconnect(); if(on){ limiter.connect(AFXX.dLp); AFXX.clip.connect(a.destination); } else limiter.connect(a.destination); }
    if(!on){ const t = a.currentTime; for(const [p, v] of [[AFXX.world.gain, 1], [AFXX.mDuck.gain, 1], [AFXX.mLp.frequency, A.music.open], [AFXX.dLp.frequency, A.deaf.lp[0]]]){ p.cancelScheduledValues(t); p.setValueAtTime(v, t); } AFXX.wT = AFXX.mT = 1; AFXX.lT = 0; AFXX.heat = AFXX.blast = 0; } }catch(e){}
  wireMusic(on); }
// every frame, before anything else of the layer (audio/afx.js updateAfx): the switch in the settings is followed at once, both ways
export function afxMixSync(){ if(!AFX.ready || !actx) return; if(!AFXX.built) build(); if(AFXX.fail) return; const on = afxOn(); if(on !== AFXX.wired) wire(on); else if(on && musicBus && AFXX.mIn !== musicBus) wireMusic(true); }

// ---- a blast (audio/afx.js afxBlast): d units off, size 1 a grenade / 2 a big one, heard at t0. The music dips; close enough, he is deafened ----
export function afxBlastMix(d, size, t0){ if(!AFXX.wired) return; const C = A.deaf, k = afxDeaf(d, size, C); if(d < A.blast.nearD) AFXX.blast = Math.max(AFXX.blast, Math.min(1, A.duck.near + k));
  if(k < C.min || PROFILE.tinnitus === false) return; AFXX.deafs++;
  try{ const a = actx, f = AFXX.dLp.frequency, hold = afxDeafHold(k, C); f.cancelScheduledValues(t0); f.setTargetAtTime(afxDeafLp(k, C), t0, C.down); f.setTargetAtTime(C.lp[0], t0 + hold, C.back);   // the world through cotton wool, then back
    if(muted || t0 < AFXX.ringUntil) return;                                                                         // (one ringing at a time; none when the sound is off)
    const T = C.ringT[0] + (C.ringT[1] - C.ringT[0]) * k, hz = C.ringHz[0] + Math.random() * (C.ringHz[1] - C.ringHz[0]), o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain(), end = t0 + hold + T; AFXX.ringUntil = end;
    o.type = o2.type = 'sine'; o.frequency.value = hz; o2.frequency.value = hz + C.beat; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(C.ring * k * sfxLevel(), t0 + C.ringUp); g.gain.setTargetAtTime(0, t0 + C.ringUp + hold, T / 4);
    o.connect(g); o2.connect(g); g.connect(AFXX.pre); o.onended = () => { try{ o.disconnect(); o2.disconnect(); g.disconnect(); }catch(e){} }; o.start(t0); o2.start(t0); o.stop(end); o2.stop(end); }catch(e){} }

// ---- the score asks (audio/music.js updateScore): the heat the director wants, or −1 = decide as before ----
export function afxMusicHeat(play, duel){ if(!play || !AFXX.wired || !DIR.on) return -1; return afxMusic(DIR.phase, DIR.P, DIR.phase === 'finale' && DIR.fin > 0, duel, A.music, AFXX.mus).heat; }

// ---- THE SQUAD CALLS OUT: the mate nearest (x, z) says it — its text over him, a radio click at his place ----
function mateNear(x, z, not){ const L = squadList(), B = A.barks; let best = null, bd = B.R * B.R;
  for(let i = 0; i < L.length; i++){ const r = L[i], a = r.a; if(!a || r === not || r.dead || a.dead || !a.pos || !FT.includes(a)) continue; const d = (a.pos.x - x) ** 2 + (a.pos.z - z) ** 2; if(d < bd){ bd = d; best = r; } } return best; }
function tagOf(r){ const C = STORY.cast; for(const k in C) if(C[k].field && C[k].name === r.name) return C[k].tag || r.name; return String(r.name || '').toUpperCase(); }   // (the cast's own tag for Hùng, Lan, Sơn; the others by their name)
export function afxBark(kind, x, z, who){ const B = A.barks, L = B.lines[kind]; if(!B.on || !L || !afxOn() || S.mode !== 'playing') return false; const r = mateNear(x, z, who); if(!r) return false;
  if(!afxBarkOk(kind.startsWith('flank') ? 'flank' : kind, AFX.now, radio.at ?? -1e9, AFXX.barks, B)) return false;
  const st = AFXX.rr[kind] || (AFXX.rr[kind] = { last:-1 }), a = r.a; _bp.x = a.pos.x; _bp.z = a.pos.z; _bp.y = heightAt(a.pos.x, a.pos.z) + B.h;
  floatText(tagOf(r) + ': ' + L[afxRR(st, L.length, Math.random)].replace('{who}', who ? who.name : ''), B.color, _bp, B.size); afxPlay('squelch', mkSquelch, 0, 0, a.pos, 'foley', A.prio.radio, B.click, 0.95 + Math.random() * 0.1, 0); AFXX.said++; return true; }
// what is polled B.tick s apart: his reload beginning under fire, a grenade of ours leaving a hand, a mate falling, the director sending men round a flank
function barks(p){ const g = p.guns && p.guns[p.gunIdx], rel = !!(g && g.rU), L = squadList(), F = DIR.on ? DIR.flank : null;
  if(rel && !AFXX.rel && DIR.near > 0) afxBark('reload', p.pos.x, p.pos.z); AFXX.rel = rel;
  for(let i = 0; i < NADES.length; i++){ const n = NADES[i]; if(n.side === 'p' && !n._bk){ n._bk = true; afxBark('nade', n.x0, n.z0); } }
  for(let i = 0; i < L.length; i++){ const r = L[i]; if(r.dead && !r._bk){ r._bk = true; afxBark('down', p.pos.x, p.pos.z, r); } else if(!r.dead && r._bk) r._bk = false; }
  if(F && F !== AFXX.flank) afxBark('flank_' + F.side, p.pos.x, p.pos.z); AFXX.flank = F; }

// ---- once a frame from audio/afx.js updateAfx (the layer on, the context running) ----
export function updateAfxMix(dt, now){ if(!AFXX.wired) return; const D = A.duck, M = A.music, p = S.player, play = S.mode === 'playing';
  const tgt = Math.min(1, (LOUD.shot + LOUD.big * D.bigK) * D.heatK); AFXX.heat = tgt > AFXX.heat ? tgt : afxFollow(AFXX.heat, tgt, dt, D.down, D.down);   // (LOUD: every sound started this frame — audio/ambience.js clears it after us)
  AFXX.blast = afxFollow(AFXX.blast, 0, dt, D.blastDown, D.blastDown);
  if(play && p && now >= AFXX.barkAt){ AFXX.barkAt = now + A.barks.tick; barks(p); }
  if(now < AFXX.at) return; AFXX.at = now + M.tick; const t = actx.currentTime, U = AFXX.mus;
  if(play && DIR.on) afxMusic(DIR.phase, DIR.P, DIR.phase === 'finale' && DIR.fin > 0, duelOn(), M, U); else { U.lp = M.open; U.gain = 1; }
  const wT = afxDuckWorld(!!VOICE.playing, 0, D), mT = U.gain * afxDuckMusic(AFXX.heat, false, D) * (1 - D.blast * AFXX.blast);
  try{ if(Math.abs(wT - AFXX.wT) > 0.01){ AFXX.wT = wT; AFXX.world.gain.setTargetAtTime(wT, t, D.glide); }
    if(Math.abs(mT - AFXX.mT) > 0.01){ AFXX.mT = mT; AFXX.mDuck.gain.setTargetAtTime(mT, t, mT < AFXX.mDuck.gain.value ? D.glide : D.back); }
    if(U.lp !== AFXX.lT){ AFXX.lT = U.lp; AFXX.mLp.frequency.setTargetAtTime(U.lp, t, M.tau); } }catch(e){} }
