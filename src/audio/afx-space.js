// audio/afx-space.js — AUDIO 2 THE SPACE THE LISTENER STANDS IN: a ring of rays round him (one ray a tick, never a burst) and the land's height say whether he is in the open, between walls, under a roof or down in a valley — the layer's reverb send is cross-faded into that space's own generated impulse response (four convolvers, built once), and a shot slaps back off the nearest one or two walls (two delay lines, computed from their distance)
//   A phone has no convolver of ours: the send stays on the old outdoor reverb, its level by the space; one slap-back line.
import { AUDIOFX } from '../../config.js';
import { AFX, BIOME, MOBILE, actx, afxIR, afxSlap, afxSpaceKind, heightAt, lineHit, master, underActive, underInside } from '../hub.js';

const A = AUDIOFX;
// what the probe knows (dev/probes read it): kind = open | walls | roof | valley · dist = each ray's wall distance · live = the convolvers are in
export const AFXS = { built:false, live:false, kind:'open', dist:null, hi:null, ray:0, at:0, walls:0, high:0, in:{}, conv:{}, wet:null, lines:[], q:{ roof:false, walls:0, high:0 }, sl:{ n:0, t:[0, 0], g:[0, 0], lp:[0, 0] } };
const soft = bl => A.space.skip.includes(bl.kind);                                                                   // (a tree, a tent: no wall to a sound)
function build(){ const a = actx, C = A.space, SL = C.slap; AFXS.built = true; AFXS.dist = new Float32Array(C.rays).fill(Infinity); AFXS.hi = new Uint8Array(C.rays);
  try{ const sin = a.createGain();                                                                                   // the slap-back: a voice's send → each line's delay → low-pass → level → the world bus
    for(let i = 0, n = MOBILE ? SL.maxPhone : SL.max; i < n; i++){ const d = a.createDelay(SL.t[1] + 0.2), f = a.createBiquadFilter(), g = a.createGain(); f.type = 'lowpass'; f.frequency.value = SL.lp[1]; g.gain.value = 0; d.delayTime.value = 0.1 + i * 0.07;
      sin.connect(d); d.connect(f); f.connect(g); g.connect(AFX.bus); AFXS.lines.push({ d, f, g, t:0, on:false }); }
    AFX.slap = sin; }catch(e){ AFX.slap = null; }
  if(MOBILE) return;
  try{ const wet = AFXS.wet = a.createGain(); wet.gain.value = C.wet; wet.connect(master); }catch(e){ return; }
  const kinds = Object.keys(C.kinds); let i = 0;                                                                     // the four responses, one a slice (each is a few ms of maths)
  const next = () => { if(actx !== a) return; if(i >= kinds.length){ swap(a); return; } const k = kinds[i++];
    try{ const ir = afxIR(a.sampleRate, C.kinds[k], AFX.rnd), b = a.createBuffer(2, ir[0].length, a.sampleRate); b.copyToChannel(ir[0], 0); b.copyToChannel(ir[1], 1);
      const cv = a.createConvolver(), g = a.createGain(); cv.buffer = b; g.gain.value = 0; g.connect(cv); cv.connect(AFXS.wet); AFXS.conv[k] = cv; AFXS.in[k] = g; }catch(e){}
    setTimeout(next, C.buildGap); };
  setTimeout(next, C.buildGap); }
// all four are in: the layer's send leaves the old outdoor reverb for them
function swap(a){ const C = A.space; for(const k in C.kinds) if(!AFXS.in[k]) return;
  try{ const t = a.currentTime; AFX.send.disconnect(); for(const k in C.kinds) AFX.send.connect(AFXS.in[k]); AFX.send.gain.cancelScheduledValues(t); AFX.send.gain.setValueAtTime(1, t); AFXS.live = true; apply(t, 0.05); }catch(e){} }   // (each space has its own level from here on)
function apply(t, tau){ const C = A.space;
  try{ if(AFXS.live){ for(const k in C.kinds) AFXS.in[k].gain.setTargetAtTime(k === AFXS.kind ? C.kinds[k].send : 0, t, tau); }
    else AFX.send.gain.setTargetAtTime(C.phone[AFXS.kind] || 1, t, tau); }catch(e){} }
// once a frame from audio/afx.js updateAfx (the listener AFX.lx / ly / lz is set): one ray; a full ring → the kind of place, the slap-back's two walls
export function updateAfxSpace(dt, now){ const C = A.space; if(!AFXS.built) build(); if(now < AFXS.at) return; AFXS.at = now + C.every / C.rays;
  const i = AFXS.ray, an = i / C.rays * Math.PI * 2, ex = Math.sin(an), ez = Math.cos(an), x = AFX.lx, z = AFX.lz, gy = AFX.ly - A.occl.eye, y = gy + C.eye;
  const h = lineHit(x, y, z, x + ex * C.R, y, z + ez * C.R, 0, 0, soft); AFXS.dist[i] = h ? h.t * C.R : Infinity;
  AFXS.hi[i] = heightAt(x + ex * C.valley.r, z + ez * C.valley.r) - gy >= C.valley.h ? 1 : 0;
  AFXS.ray = (i + 1) % C.rays; if(AFXS.ray !== 0) return;
  let walls = 0, high = 0; for(let k = 0; k < C.rays; k++){ if(AFXS.dist[k] <= C.wallR) walls++; high += AFXS.hi[k]; }
  const Q = AFXS.q; Q.roof = !!BIOME.cave || underActive(x) && underInside(x, z, 0); Q.walls = AFXS.walls = walls; Q.high = AFXS.high = high;
  const kind = afxSpaceKind(Q, C), t = actx.currentTime; if(kind !== AFXS.kind){ AFXS.kind = kind; apply(t, C.fade); }
  const SL = C.slap, R = AFXS.sl; afxSlap(AFXS.dist, C.rays, SL, A.unit, A.c, R);
  for(let k = 0; k < AFXS.lines.length; k++){ const L = AFXS.lines[k], on = k < R.n;
    try{ if(on && Math.abs(R.t[k] - L.t) > L.t * SL.move){ L.t = R.t[k]; L.d.delayTime.setTargetAtTime(L.t, t, SL.glide); L.f.frequency.setTargetAtTime(R.lp[k], t, SL.glide); }   // (the wall has to move a fair way before the line is retimed: a gliding delay bends the pitch)
      if(on || L.on) L.g.gain.setTargetAtTime(on ? R.g[k] : 0, t, SL.glide); L.on = on; }catch(e){} } }
