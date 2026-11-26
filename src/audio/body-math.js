// audio/body-math.js — HIT 1 the takes of a man's body struck, pure maths (no imports: runs in Node, test.js): each returns a mono Float32Array at sr, rnd = a 0…1 source.
//   Played by audio/body-hit.js (his own hit, his heart and breath low on health) and audio/synth.js SND.flesh (a round into any man in the world).
const TAU = Math.PI * 2;
const fbuf = (s, sr) => new Float32Array(Math.max(8, Math.round(s * sr)));
function lp1(x, fc, sr){ const a = 1 - Math.exp(-TAU * Math.min(fc, sr * 0.45) / sr); let y = 0; for(let i = 0; i < x.length; i++){ y += (x[i] - y) * a; x[i] = y; } return x; }
function hp1(x, fc, sr){ const a = 1 - Math.exp(-TAU * Math.min(fc, sr * 0.45) / sr); let y = 0; for(let i = 0; i < x.length; i++){ y += (x[i] - y) * a; x[i] -= y; } return x; }
function bp2(x, f, q, sr){ const w = TAU * Math.min(f, sr * 0.45) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al, b0 = al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for(let i = 0; i < x.length; i++){ const v = x[i], y = b0 * v - b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; } return x; }
function nz(s, sr, rnd, env){ const x = fbuf(s, sr), n = x.length; for(let i = 0; i < n; i++) x[i] = (rnd() * 2 - 1) * env(i / sr, i / n); return x; }
function add(d, s, at, g, sr){ const o = Math.round((at || 0) * sr); for(let i = 0; i < s.length && o + i < d.length; i++) d[o + i] += s[i] * g; return d; }
function thump(s, sr, f0, f1, tau){ const x = fbuf(s, sr); let ph = 0; for(let i = 0; i < x.length; i++){ const t = i / sr; ph += TAU * (f1 + (f0 - f1) * Math.exp(-t / (tau * 0.6))) / sr; x[i] = Math.sin(ph) * Math.exp(-t / tau) * Math.min(1, t / 0.0015); } return x; }
function done(x, peak, sr){ let m = 1e-9; for(let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); const k = peak / m, f = Math.min(x.length, Math.round(0.004 * sr));
  for(let i = 0; i < x.length; i++) x[i] *= k; for(let i = 0; i < f; i++) x[x.length - 1 - i] *= i / f; return x; }
const dec = tau => t => Math.exp(-t / tau);
// a round into a body: a low punch (pitch falling 150 → 60 Hz, gone in ~50 ms) + the slap of cloth and flesh (low-passed noise) — dull, short, no partials that ring
export function bodyThwackBuf(sr, rnd){ const x = fbuf(0.2, sr), f0 = 135 + rnd() * 35;
  add(x, thump(0.18, sr, f0, 55, 0.045), 0, 1, sr); add(x, lp1(lp1(nz(0.06, sr, rnd, dec(0.011)), 1300 + rnd() * 400, sr), 1800, sr), 0, 1.5, sr);
  add(x, bp2(nz(0.05, sr, rnd, dec(0.014)), 650 + rnd() * 200, 0.8, sr), 0.002, 0.7, sr); return done(lp1(x, 4000, sr), 0.85, sr); }
// the round meeting his plate carrier: a hard, dead TOCK (ceramic / kevlar in nylon — a few ms of a damped knock, a scuff of webbing), never a bell
export function bodyPlateBuf(sr, rnd){ const x = fbuf(0.09, sr); add(x, bp2(nz(0.012, sr, rnd, dec(0.0025)), 2300 + rnd() * 700, 1.8, sr), 0, 1.6, sr);
  add(x, bp2(nz(0.03, sr, rnd, dec(0.006)), 900 + rnd() * 250, 2.5, sr), 0, 1.0, sr); add(x, bp2(nz(0.07, sr, rnd, (t, u) => Math.sin(Math.PI * u) * 0.6), 1600, 0.6, sr), 0.006, 0.35, sr);
  return done(lp1(x, 6000, sr), 0.8, sr); }
// a blast into him: a deep body thump (the pressure), dirt and grit coming down over a second
export function bodyBlastBuf(sr, rnd){ const x = fbuf(1.0, sr); add(x, thump(0.4, sr, 90, 38, 0.11), 0, 1, sr); add(x, lp1(nz(0.25, sr, rnd, dec(0.06)), 380, sr), 0, 1.4, sr);
  for(let k = 0; k < 16; k++) add(x, hp1(nz(0.006 + rnd() * 0.012, sr, rnd, (t, u) => 1 - u), 1500 + rnd() * 2500, sr), 0.12 + rnd() * 0.75, 0.12 + rnd() * 0.16, sr);   // the grit raining on him
  return done(x, 0.85, sr); }
// fire on him: a sharp breath in through the teeth (rising hiss, two throat bands) — no crackle of a burning body
export function bodyGaspBuf(sr, rnd){ const x = fbuf(0.3, sr), e = (t, u) => Math.min(1, t / 0.12) * (1 - u) * (1 - u);
  add(x, bp2(nz(0.3, sr, rnd, e), 1500 + rnd() * 300, 2.2, sr), 0, 1, sr); add(x, bp2(nz(0.3, sr, rnd, e), 2700 + rnd() * 400, 3, sr), 0, 0.5, sr); return done(hp1(x, 500, sr), 0.6, sr); }
// his heart, low on health: lub … dub, felt more than heard
export function bodyBeatBuf(sr){ const x = fbuf(0.42, sr); add(x, thump(0.16, sr, 62, 42, 0.05), 0, 1, sr); add(x, thump(0.16, sr, 56, 40, 0.045), 0.2, 0.7, sr); return done(x, 0.8, sr); }
// his breathing, low on health: a long ragged breath out
export function bodyBreathBuf(sr, rnd){ const x = fbuf(0.7, sr); add(x, bp2(nz(0.7, sr, rnd, (t, u) => Math.sin(Math.PI * Math.min(1, u * 1.3)) * (0.75 + 0.25 * Math.sin(t * 38))), 850 + rnd() * 200, 0.9, sr), 0, 1, sr);
  return done(lp1(x, 2400, sr), 0.6, sr); }

