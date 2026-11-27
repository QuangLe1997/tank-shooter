// audio/body-hit.js — HIT 1 A MAN IS HIT, NOT A HULL: what HE hears when he is struck (game/player-damage.js), synthesised, no file added and never a steel plate.
//   a round → a dull flesh / kevlar THWACK (a low punch into a body + the cloth slapped), sometimes a TICK on his plate carrier (by the hit's height), his breath
//   knocked out (a grunt, the voiced push of audio/afx-math.js afxGruntBuf); heavy → louder, a short ringing ear, the world muffled a moment (the sound layer's
//   low-pass, audio/afx-mix.js) · a blast that hurts him → a body thump, grit raining down, the ringing · fire → a sharp breath in, no blood · a fall → a thud + grunt.
//   Low on health: his heart and his breathing (updateBodyHit, from fx/soldier-fx.js). Every buffer is rendered once (BODYHIT.snd), a few takes each, round-robin.
//   The takes are pure maths (audio/body-math.js, runs in Node). SND.flesh (audio/synth.js) is the same thwack heard in the world: a round into an enemy or one of ours — no armour ring there either.
import { BODYHIT, HURTFX } from '../../config.js';
import { AFXX, PROFILE, actx, afxGruntBuf, audio, bodyBeatBuf, bodyBlastBuf, bodyBreathBuf, bodyGaspBuf, bodyPlateBuf, bodyThwackBuf, duck, master, muted } from '../hub.js';

// what was played (dev / probes read it): counts by kind, and the last few names in order
export const BH = { n:{}, log:[], hitAt:-9, gruntAt:-9, fireAt:-9, ringUntil:0, beatAt:0, breathAt:0, bufs:{} };
function note(k){ BH.n[k] = (BH.n[k] | 0) + 1; BH.log.push(k); if(BH.log.length > 24) BH.log.shift(); }

const MAKE = { thwack:bodyThwackBuf, plate:bodyPlateBuf, blast:bodyBlastBuf, gasp:bodyGaspBuf, beat:bodyBeatBuf, breath:bodyBreathBuf, grunt:afxGruntBuf };
function take(k){ let L = BH.bufs[k]; if(!L) L = BH.bufs[k] = { b:[], i:0 }; const sr = actx.sampleRate;
  if(L.b.length < 3){ const d = MAKE[k](sr, Math.random), b = actx.createBuffer(1, d.length, sr); b.copyToChannel(d, 0); L.b.push(b); return b; }
  L.i = (L.i + 1 + ((Math.random() * (L.b.length - 1)) | 0)) % L.b.length; return L.b[L.i]; }   // (never the same take twice running)
// one take straight into the master (his own body: no distance, no duck under a blast), at t s from now
function one(k, g, rate, at, nm){ const b = take(k), s = actx.createBufferSource(), gn = actx.createGain(); s.buffer = b; s.playbackRate.value = rate; gn.gain.value = g; s.connect(gn).connect(master);
  s.onended = () => { try{ s.disconnect(); gn.disconnect(); }catch(e){} }; s.start(actx.currentTime + (at || 0)); note(nm || k); }
function ok(){ if(muted || !(PROFILE && PROFILE.sound !== false)) return false; const a = audio(); return !!a && a.state === 'running' && !!master; }
// a ringing ear: two close sines beating, k = 0 … 1
function ring(k){ const C = BODYHIT.snd, t0 = actx.currentTime; if(t0 < BH.ringUntil || PROFILE.tinnitus === false || (AFXX && t0 < AFXX.ringUntil)) return;   // (one ringing at a time — the blast's own, audio/afx-mix.js, counts)
  const T = C.ringT[0] + (C.ringT[1] - C.ringT[0]) * k, hz = C.ringHz[0] + Math.random() * (C.ringHz[1] - C.ringHz[0]), o = actx.createOscillator(), o2 = actx.createOscillator(), g = actx.createGain(); BH.ringUntil = t0 + T;
  o.frequency.value = hz; o2.frequency.value = hz + 6; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(C.ring * k, t0 + 0.04); g.gain.setTargetAtTime(0, t0 + 0.06, T / 4);
  o.connect(g); o2.connect(g); g.connect(master); o.onended = () => { try{ o.disconnect(); o2.disconnect(); g.disconnect(); }catch(e){} }; o.start(t0); o2.start(t0); o.stop(t0 + T); o2.stop(t0 + T); note('ring'); }
// the world through cotton wool for a moment (only while the sound layer has its master low-pass in: audio/afx-mix.js)
function muffle(M){ if(!AFXX || !AFXX.wired || !AFXX.dLp || PROFILE.tinnitus === false) return; try{ const f = AFXX.dLp.frequency, t0 = actx.currentTime;
  if(f.value < M.lp) return; f.cancelScheduledValues(t0); f.setTargetAtTime(M.lp, t0, 0.02); f.setTargetAtTime(20000, t0 + M.hold, M.back); note('muffle'); }catch(e){} }   // (a deeper dip already on: leave it)

// HURT 1 the world's small arms dipped a moment under his own hit, so the thud lands (the duck bus, audio/synth.js; a blast's deeper dip already on: left alone)
function dip(to){ const D = HURTFX.snd; if(!duck) return; try{ const g = duck.gain, t0 = actx.currentTime; if(g.value <= to + 0.02) return;
  g.cancelScheduledValues(t0); g.setValueAtTime(g.value, t0); g.setTargetAtTime(to, t0, 0.008); g.setTargetAtTime(1, t0 + D.hold, D.back); note('dip'); }catch(e){} }
// ---- the call (game/player-damage.js): kind 'shot' | 'blast' | 'fire' | 'fall', dmg after armour, plate = the round met his plate carrier ----
export function bodyHitSound(kind, dmg, plate){ if(!ok()) return false; const C = BODYHIT.snd, now = actx.currentTime, heavy = dmg >= BODYHIT.heavy, hk = heavy ? C.heavyK : 1, r = () => 0.93 + Math.random() * 0.14;
  if(kind === 'fire'){ if(now - BH.fireAt < C.fireGap) return true; BH.fireAt = now; one('gasp', C.gasp, r(), 0); return true; }
  if(kind === 'blast'){ one('blast', C.blast * Math.min(1.4, 0.7 + dmg / 40), r(), 0); one('thwack', C.thud * 0.7, 0.85 * r(), 0.005); if(heavy || dmg >= BODYHIT.heavy * 0.6){ ring(Math.min(1, dmg / (BODYHIT.heavy * 2))); muffle(C.muffleB); } }
  else if(kind === 'fall') one('thwack', C.fall, 0.8 * r(), 0);
  else if(HURTFX.on){ const D = HURTFX.snd; if(now - BH.hitAt >= D.gap || heavy){ BH.hitAt = now;   // HURT 1 a round: the body's thud (+ the same thud higher: what a small speaker carries), the kevlar's tock every time; one per gap under automatic fire
      one('thwack', C.thud * hk, r(), 0); one('thwack', D.punch * hk, D.punchRate * r(), 0.001, 'punch'); one('plate', (plate ? C.tick : D.tock) * hk, r(), 0.002, plate ? 'plate' : 'tock'); dip(heavy ? D.duckH : D.duck); }
    if(heavy){ ring(Math.min(1, dmg / (BODYHIT.heavy * 2.5))); muffle(C.muffle); } }   // heavy: louder, the ear rings, the world muffled a moment
  else { one('thwack', C.thud * hk, r(), 0); if(plate) one('plate', C.tick * hk, r(), 0.002); if(heavy){ ring(Math.min(1, dmg / (BODYHIT.heavy * 2.5))); muffle(C.muffle); } }
  if(now - BH.gruntAt >= (HURTFX.on && kind === 'shot' ? HURTFX.snd.gruntGap : C.gruntGap)){ BH.gruntAt = now; one('grunt', C.grunt * (heavy ? 1.25 : 1), (kind === 'blast' || heavy ? 0.88 : 1) * r(), 0.05 + Math.random() * 0.04); }   // his breath knocked out, a beat after the blow
  return true; }

// ---- low on health (fx/soldier-fx.js updateBodyHit, every frame while he fights): his heart, faster the lower he is, and a ragged breath ----
export function bodyLowSound(f, now){ const L = BODYHIT.low; if(!(f < L.below) || !(f > 0) || !ok()) return;
  const k = 1 - f / L.below, per = L.beat[1] - (L.beat[1] - L.beat[0]) * k;
  if(now >= BH.beatAt){ BH.beatAt = now + per; one('beat', L.beatG * (0.6 + 0.4 * k), 1, 0); }
  if(now >= BH.breathAt){ BH.breathAt = now + L.breath * (1.1 - 0.35 * k) * (0.85 + Math.random() * 0.3); one('breath', L.breathG * (0.7 + 0.3 * k), 0.95 + Math.random() * 0.1, 0); } }
