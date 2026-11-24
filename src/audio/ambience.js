// audio/ambience.js — NATURE AMBIENCE (AMBIENCE): a quiet bed under the battle (wind · leaves on the green fields · the sea's wash under the arctic shelf · rain) and now and then a call placed round the listener (songbirds, a dove, gulls, a raptor; crickets and an owl at night; swallows twittering as a flock passes), all synthesised; ducked under every shot and blast, quiet while the fight is hot, up in the lulls and behind the menus (PROFILE.ambience)
import { AMBIENCE } from '../../config.js';
import { BIOME, LOUD, PROFILE, S, VOICE, actx, camera, enemies, fieldDepth, flockBird, heightAt, master, muted, verbSend } from '../hub.js';

// The calls and the bed's loops are rendered once, in idle slices, at 32 kHz (nothing in them sits above ~9 kHz): a third less work than 48 k.
const RATE = 32000;
export const AMB = { bus:null, wet:null, bed:null, bufs:{}, bank:{}, queue:[], queued:{}, rendering:false, heat:0, foes:0, foeT:0, duck:1, sent:-1, sentAt:0,
  calm:0, nextAt:0, answerAt:0, answerKind:'', live:0, tick:0, waveAt:0, offT:0, key:'', log:[], fired:{}, skipped:{ hot:0, busy:0, cold:0 } };
const PLAYISH = { playing:1, countdown:1, intro:1 };
const rnd = (a, b) => a + Math.random() * (b - a), pickR = r => rnd(r[0], r[1]);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function ambienceOn(){ return !!AMBIENCE.on && PROFILE.ambience !== false && PROFILE.sound !== false && !muted && !BIOME.cave; }
const biomeAmb = () => AMBIENCE.biomes[BIOME.name] || AMBIENCE.biomes._;

// ---------------------------------------------------------------- offline synthesis ----------------------------------------------------------------
function fbuf(sec){ return new Float32Array(Math.max(1, Math.round(sec * RATE))); }
function bq(x, type, f, q){ const w = 2 * Math.PI * Math.min(f, RATE * 0.45) / RATE, cs = Math.cos(w), al = Math.sin(w) / (2 * (q || 0.707)); let b0, b1, b2;   // RBJ biquad, in place
  if(type === 'lp'){ b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; } else if(type === 'hp'){ b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al, a1 = -2 * cs / a0, a2 = (1 - al) / a0; b0 /= a0; b1 /= a0; b2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for(let i = 0; i < x.length; i++){ const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; } return x; }
function norm(x, peak){ let m = 1e-6; for(let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); const k = peak / m; for(let i = 0; i < x.length; i++) x[i] *= k; return x; }
// a smooth window: rises over the first a of the note, falls over the last r
const win = (a, r) => u => { const e = u < a ? Math.sin(1.5708 * u / a) : u > 1 - r ? Math.sin(1.5708 * Math.max(0, 1 - u) / r) : 1; return e * e; };
// one voiced note into x from t0 s for dur s: pitch f(u) over u 0…1, harmonic amplitudes H (band-limited), envelope env(u), gain g, am(t) a flutter
function note(x, t0, dur, f, H, env, g, am){ const i0 = Math.round(t0 * RATE), n = Math.max(1, Math.round(dur * RATE)); let ph = Math.random() * 6.283;
  for(let i = 0; i < n; i++){ const j = i0 + i; if(j >= x.length) break; const u = i / n, fr = f(u); ph += 6.283185 * fr / RATE; let v = 0;
    for(let k = 0; k < H.length; k++){ if(fr * (k + 1) > RATE * 0.45) break; v += H[k] * Math.sin(ph * (k + 1)); }
    x[j] += v * env(u) * g * (am ? am(i / RATE) : 1); } }
// a loop's ends folded over each other (equal power) so it repeats without a click
function seam(x){ const F = Math.round(0.25 * RATE), n = x.length - F, y = new Float32Array(n); for(let i = 0; i < n; i++) y[i] = x[i];
  for(let i = 0; i < F; i++){ const u = i / F; y[i] = x[i] * Math.sin(1.5708 * u) + x[n + i] * Math.cos(1.5708 * u); } return y; }
// the bed's loops: pink noise (wind, rain), brown noise (the sea), a leaf rustle (grains of noise at a slowly wandering density)
const LOOPS = {
  pink(){ const x = fbuf(8.25); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for(let i = 0; i < x.length; i++){ const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; x[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926; }
    return seam(norm(x, 0.9)); },
  brown(){ const x = fbuf(8.25); let l = 0; for(let i = 0; i < x.length; i++){ l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; x[i] = l; } return seam(norm(bq(x, 'hp', 25), 0.9)); },
  rustle(){ const x = fbuf(6.25); let env = 0, dens = 0.5;
    for(let i = 0; i < x.length; i++){ if(i % 800 === 0) dens = Math.max(0.15, Math.min(1, dens + (Math.random() - 0.5) * 0.3));
      if(Math.random() < dens * 0.006) env += 0.3 + Math.random() * 0.7; env *= 0.9965; x[i] = (Math.random() * 2 - 1) * env; }
    return seam(norm(bq(bq(x, 'hp', 1500), 'lp', 7500), 0.9)); } };
// the calls: each returns a mono take; a kind gets AMBIENCE.calls.variants takes, played with a little detune so no two sound alike
export const AMB_RECIPES = {
  // a warbler's song: two to four runs of a repeated syllable (fast FM chirps sweeping down or up, some buzzy), each run quickening
  trill(){ const parts = []; let t = 0.03;
    for(let s = 0, n = 2 + (Math.random() * 3 | 0); s < n; s++){ const k = 4 + (Math.random() * 8 | 0), rate = rnd(11, 22), d = Math.min(0.075, rnd(0.45, 0.7) / rate), f0 = rnd(2800, 6200);
      const f1 = Math.random() < 0.4 ? f0 * rnd(1.2, 1.5) : f0 * rnd(0.5, 0.75), fm = Math.random() < 0.35 ? rnd(45, 90) : 0; parts.push({ t, k, rate, d, f0, f1, fm, a:rnd(0.55, 1) }); t += k / rate * 0.9 + rnd(0.04, 0.14); }
    const x = fbuf(t + 0.1);
    for(const p of parts){ let tt = p.t; for(let i = 0; i < p.k; i++){ note(x, tt, p.d, u => p.f0 + (p.f1 - p.f0) * u + (p.fm ? p.f0 * 0.05 * Math.sin(6.283 * p.fm * u * p.d) : 0), [1, 0.1, 0.03], win(0.15, 0.45), p.a * rnd(0.75, 1) * (1 - 0.3 * i / p.k)); tt += (1 - 0.2 * i / p.k) / p.rate; } }
    return norm(x, 0.9); },
  // a clear whistled phrase (a magpie-robin, a bulbul): three to six notes on a pentatonic over 1.7–2.5 kHz, some sliding up or down, a light vibrato
  whistle(){ const b = rnd(1700, 2500), sc = [1, 1.125, 1.25, 1.5, 1.667, 2], notes = []; let t = 0.03;
    for(let i = 0, n = 3 + (Math.random() * 4 | 0); i < n; i++){ const fa = b * sc[Math.random() * sc.length | 0], r = Math.random(), d = rnd(0.08, 0.26); notes.push({ t, d, fa, fb:r < 0.4 ? fa : r < 0.7 ? fa * rnd(1.15, 1.35) : fa * rnd(0.7, 0.88) }); t += d + rnd(0.04, 0.14); }
    const x = fbuf(t + 0.1), vib = rnd(7, 12);
    for(const p of notes) note(x, p.t, p.d, u => (p.fa + (p.fb - p.fa) * Math.pow(u, 0.6)) * (1 + 0.015 * Math.sin(6.283 * vib * u * p.d)), [1, 0.12, 0.03], win(0.12, 0.3), rnd(0.7, 1));
    return norm(x, 0.9); },
  // a sparrow's chatter: two to six short harsh chips falling fast from ~5 kHz
  chip(){ const n = 2 + (Math.random() * 5 | 0), x = fbuf(n * 0.25 + 0.1); let t = 0.02;
    for(let i = 0; i < n; i++){ const d = rnd(0.035, 0.08), f0 = rnd(4600, 6000), f1 = f0 * rnd(0.5, 0.65); note(x, t, d, u => f0 * Math.pow(f1 / f0, u), [1, 0.35, 0.15], win(0.1, 0.5), rnd(0.7, 1)); t += d + rnd(0.06, 0.16); }
    return norm(x, 0.9); },
  // the spotted dove (chim cu gáy): "cúc — cù-rù — cu", soft and low, the middle note rolled; once or twice
  dove(){ const b = rnd(470, 560), reps = Math.random() < 0.5 ? 2 : 1, x = fbuf(reps * 2.05 + 0.2), H = [1, 0.22, 0.08], rr = t => 1 - 0.35 * (0.5 + 0.5 * Math.sin(6.283 * 28 * t));
    for(let r = 0; r < reps; r++){ const t0 = 0.05 + r * 2.0;
      note(x, t0, 0.14, u => b * (1.08 - 0.08 * u), H, win(0.3, 0.4), 0.7);
      note(x, t0 + 0.2, 0.34, u => b * (u < 0.35 ? 1.12 + 0.24 * u : 1.2 - 0.22 * (u - 0.35) / 0.65), H, win(0.25, 0.35), 1, rr);
      note(x, t0 + 0.95, 0.46, u => b * (1.02 - 0.12 * u), H, win(0.2, 0.5), 0.85); }
    return norm(bq(x, 'lp', 2400), 0.85); },
  // a herring gull: the long "kee-ow" (a jump up, a long fall, rich in harmonics through a nasal formant, rough) and / or the laughing "ha-ha-ha"
  gull(){ const style = Math.random(), f0 = rnd(1150, 1450), parts = []; let t = 0.03;
    const kyow = () => { const d = rnd(0.34, 0.5); parts.push({ t, d, f:u => u < 0.12 ? f0 * (1 + 0.25 * u / 0.12) : f0 * 1.25 * (1 - 0.42 * Math.pow((u - 0.12) / 0.88, 0.8)), g:1 }); t += d + rnd(0.12, 0.3); };
    const ha = k => { for(let i = 0; i < k; i++){ const d = rnd(0.1, 0.15), fh = f0 * rnd(0.78, 0.9); parts.push({ t, d, f:u => fh * (1.04 - 0.1 * u), g:0.85 - 0.4 * i / k }); t += rnd(0.17, 0.23); } };
    if(style < 0.45){ kyow(); ha(3 + (Math.random() * 5 | 0)); } else if(style < 0.8){ kyow(); kyow(); if(Math.random() < 0.5) kyow(); } else ha(3 + (Math.random() * 4 | 0));
    const x = fbuf(t + 0.1), H = [1, 0.85, 0.7, 0.55, 0.42, 0.3, 0.22, 0.15, 0.1], am = s => 1 - 0.22 * (0.5 + 0.5 * Math.sin(6.283 * 72 * s));
    for(const p of parts){ note(x, p.t, p.d, p.f, H, win(0.08, 0.25), p.g, am);
      const i0 = Math.round(p.t * RATE), n = Math.round(p.d * RATE), e = win(0.1, 0.4); for(let i = 0; i < n && i0 + i < x.length; i++) x[i0 + i] += (Math.random() * 2 - 1) * 0.08 * p.g * e(i / n); }   // breath
    const y = bq(Float32Array.from(x), 'bp', 2600, 1.1); for(let i = 0; i < x.length; i++) x[i] = x[i] * 0.45 + y[i] * 1.4;
    return norm(bq(x, 'lp', 6500), 0.9); },
  // a kite / buzzard high over the field: a short rising "pee", then a long falling quavering "eeee-uu"
  raptor(){ const x = fbuf(1.9), a = rnd(2300, 2700), b = rnd(2900, 3300), c = rnd(1800, 2100), q = rnd(20, 27), H = [1, 0.18, 0.05];
    note(x, 0.03, 0.24, u => a + (b - a) * Math.sqrt(u), H, win(0.2, 0.3), 0.8);
    note(x, 0.36, 1.35, u => (b - (b - c) * Math.pow(u, 0.8)) * (1 + 0.028 * u * Math.sin(6.283 * q * u * 1.35)), H, win(0.06, 0.5), 1, s => 1 - 0.35 * Math.min(1, s / 0.6) * (0.5 + 0.5 * Math.sin(6.283 * q * s)));
    return norm(x, 0.9); },
  // a scops owl at night: two to four soft low hoots a second apart
  owl(){ const n = 2 + (Math.random() * 3 | 0), b = rnd(360, 440), gap = rnd(0.9, 1.3), x = fbuf(n * gap + 0.5);
    for(let i = 0; i < n; i++) note(x, 0.05 + i * gap, rnd(0.22, 0.34), u => b * (u < 0.15 ? 0.88 + 0.8 * u : 1 - 0.08 * (u - 0.15)), [1, 0.12, 0.03], win(0.3, 0.45), i === n - 1 ? 1 : 0.85);
    return norm(x, 0.85); },
  // a cricket: chirps of three to five pulses on a 4.2–4.9 kHz carrier, two a second
  cricket(){ const fc = rnd(4200, 4900), chirps = 4 + (Math.random() * 5 | 0), per = rnd(0.45, 0.7), pulses = 3 + (Math.random() * 3 | 0), x = fbuf(chirps * per + 0.2);
    for(let c = 0; c < chirps; c++) for(let p = 0; p < pulses; p++) note(x, 0.02 + c * per + p * 0.03, 0.016, () => fc, [1, 0.05], win(0.3, 0.5), rnd(0.8, 1));
    return norm(x, 0.8); },
  // swallows on the wing: quick high "vit-vit" chevrons and a rattling warble
  swallow(){ const n = 6 + (Math.random() * 9 | 0), x = fbuf(n * 0.2 + 0.3); let t = 0.02;
    for(let i = 0; i < n; i++){ const f0 = rnd(3600, 6000);
      if(Math.random() < 0.2){ const d = rnd(0.12, 0.2), fm = rnd(55, 90); note(x, t, d, u => f0 * (1 + 0.12 * Math.sin(6.283 * fm * u * d)), [1, 0.1], win(0.1, 0.2), 0.6); t += d + rnd(0.04, 0.1); }
      else { const d = rnd(0.025, 0.06), pk = f0 * rnd(1.25, 1.6); note(x, t, d, u => f0 + (pk - f0) * Math.sin(3.1416 * u), [1, 0.1], win(0.15, 0.4), rnd(0.6, 1)); t += d + rnd(0.04, 0.15); } }
    return norm(x, 0.85); },
  // a wave breaking under the shelf: the swell rising, the crash opening the low-pass, the long wash back and the foam's hiss
  surf(){ const L = rnd(4, 5.5), x = fbuf(L), A = rnd(0.8, 1.3), T = rnd(1.2, 1.8); let lp = 0, br = 0, hp = 0, last = 0;
    for(let i = 0; i < x.length; i++){ const t = i / RATE, e = t < A ? sm(0, A, t) : Math.exp(-(t - A) / T), w = Math.random() * 2 - 1; br = (br + 0.02 * w) / 1.02;
      const c = 1 - Math.exp(-6.283 * (200 + 2400 * Math.pow(e, 1.5)) / RATE); lp += c * ((w * 0.6 + br * 3) - lp);
      hp = 0.85 * (hp + w - last); last = w; x[i] = lp * e + hp * (t > A ? Math.exp(-(t - A) / (T * 1.3)) : 0) * 0.18; }
    return norm(x, 0.9); } };

// ---------------------------------------------------------------- render in idle slices ----------------------------------------------------------------
function toBuf(x){ const b = actx.createBuffer(1, x.length, RATE); b.copyToChannel(x, 0); return b; }
function want(kind){ const B = AMB.bank[kind] || (AMB.bank[kind] = []), n = AMBIENCE.calls.variants; if(!AMB_RECIPES[kind] || B.length + (AMB.queued[kind] | 0) >= n) return;
  for(let i = B.length + (AMB.queued[kind] | 0); i < n; i++){ AMB.queued[kind] = (AMB.queued[kind] | 0) + 1; AMB.queue.push(() => { AMB.queued[kind]--; if(B.length < n) B.push(toBuf(AMB_RECIPES[kind]())); }); } pump(); }
function wantLoop(k){ if(AMB.bufs[k] || AMB.queued[k]) return; AMB.queued[k] = 1; AMB.queue.unshift(() => { AMB.queued[k] = 0; AMB.bufs[k] = toBuf(LOOPS[k]()); }); pump(); }
function pump(){ if(AMB.rendering || !AMB.queue.length) return; AMB.rendering = true;
  const go = dl => { const t0 = performance.now(); do { const job = AMB.queue.shift(); if(job) job(); } while(AMB.queue.length && (dl && dl.timeRemaining ? dl.timeRemaining() > 6 : performance.now() - t0 < 3));
    AMB.rendering = false; if(AMB.queue.length) setTimeout(pump, 30); };
  if(typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout:900 }); else setTimeout(() => go(null), 60); }

// ---------------------------------------------------------------- the bed ----------------------------------------------------------------
function loopSrc(a, k){ const s = a.createBufferSource(); s.buffer = AMB.bufs[k]; s.loop = true; s.start(a.currentTime, Math.random() * (AMB.bufs[k].duration - 0.1)); return s; }
function filt(a, type, f, q){ const n = a.createBiquadFilter(); n.type = type; n.frequency.value = f; if(q) n.Q.value = q; return n; }
function gainN(a, v){ const g = a.createGain(); g.gain.value = v; return g; }
function buildBed(a, B){ const out = gainN(a, 0), L = { out, key:BIOME.name, srcs:[], wind:null, howl:null, leaves:null, sea:null, rain:null }; out.connect(AMB.bus); out.gain.setTargetAtTime(1, a.currentTime, AMBIENCE.bed.fade / 3);
  const lay = (k, chain, g0) => { const s = loopSrc(a, k), g = gainN(a, g0 || 0); let n = s; for(const f of chain){ n.connect(f); n = f; } n.connect(g); g.connect(out); L.srcs.push(s); return { g, f:chain }; };
  if(B.bed.wind){ L.wind = lay('pink', [filt(a, 'lowpass', 500, 0.6)]); L.howl = lay('pink', [filt(a, 'bandpass', 700, 6)]); }
  if(B.bed.leaves) L.leaves = lay('rustle', []);
  if(B.bed.sea){ L.sea = lay('brown', [filt(a, 'lowpass', 420, 0.7)]); if(a.createStereoPanner){ const p = a.createStereoPanner(); L.sea.g.disconnect(); L.sea.g.connect(p).connect(out); L.sea.pan = p; } }
  return L; }
function addRain(a, L){ if(L.rain || !AMB.bufs.pink) return; const s = loopSrc(a, 'pink'), hp = filt(a, 'highpass', 900, 0.7), lp = filt(a, 'lowpass', 7000, 0.7), g = gainN(a, 0);
  s.connect(hp).connect(lp).connect(g).connect(L.out); L.srcs.push(s); L.rain = { g }; }
function dropBed(L){ if(!L || !actx) return; L.out.gain.setTargetAtTime(0, actx.currentTime, 0.5); setTimeout(() => { for(const s of L.srcs){ try{ s.stop(); }catch(e){} } try{ L.out.disconnect(); }catch(e){} }, 3500); }
const gust = t => Math.min(1, Math.max(0, 0.5 + 0.28 * Math.sin(0.11 * t + 1.3) + 0.17 * Math.sin(0.29 * t + 0.4) + 0.1 * Math.sin(0.83 * t + 2.1) + 0.05 * Math.sin(1.9 * t)));
// ten times a second: the gusts lean on the wind and stir the leaves, the waves come in one by one, nearer the edge the louder
function stirBed(a, L, B, E, now){ const t = a.currentTime, Bd = AMBIENCE.bed, W = AMBIENCE.wx[S.weather] || {}, gu = gust(now), set = (p, v, tc) => p.setTargetAtTime(v, t, tc || 0.35);
  if(L.wind){ const w = Bd.wind * B.bed.wind * (W.wind ?? 1); set(L.wind.g.gain, w * (0.55 + 0.45 * Math.pow(gu, 1.5))); set(L.wind.f[0].frequency, 280 + 760 * gu, 0.5);
    set(L.howl.g.gain, w * 0.22 * gu * gu); set(L.howl.f[0].frequency, 480 + 520 * gu, 0.8); }
  if(L.leaves) set(L.leaves.g.gain, Bd.leaves * B.bed.leaves * (0.2 + 0.8 * gu * gu) * Math.min(1.4, W.wind ?? 1));
  if(W.rain) addRain(a, L); if(L.rain) set(L.rain.g.gain, W.rain ? Bd.rain * (0.85 + 0.15 * Math.sin(now * 0.7)) : 0, 1.2);
  if(L.sea){ const dep = Math.max(0, fieldDepth(E.x, E.z)), near = 1 - sm(Bd.edge[0], Bd.edge[1], dep), lvl = Bd.sea * B.bed.sea * (0.3 + 0.7 * near);
    if(now >= AMB.waveAt){ AMB.waveAt = now + pickR(Bd.wave); const g = L.sea.g.gain, f = L.sea.f[0].frequency;   // one wave: up over ~2 s, the filter opening, then the long draw back
      g.cancelScheduledValues(t); g.setTargetAtTime(lvl, t, 0.7); g.setTargetAtTime(lvl * 0.35, t + 2, 1.6); f.cancelScheduledValues(t); f.setTargetAtTime(900, t, 0.8); f.setTargetAtTime(320, t + 2, 1.8); }
    if(L.sea.pan){ const r = Math.hypot(E.x, E.z) || 1; L.sea.pan.pan.setTargetAtTime(panOf(E.x + E.x / r * 50, E.z + E.z / r * 50) * 0.7 * near, t, 0.5); } } }

// ---------------------------------------------------------------- placing a call ----------------------------------------------------------------
function ear(){ const p = S.player; return p && (PLAYISH[S.mode] || S.mode === 'paused' || S.mode === 'dying') ? p.pos : camera.position; }
// left / right off the camera's own right vector (front and back sound alike, as in a stereo pair)
function panOf(x, z){ const e = camera.matrixWorld.elements, rx = e[0], rz = e[2], dx = x - camera.position.x, dz = z - camera.position.z, l = Math.hypot(dx, dz) * (Math.hypot(rx, rz) || 1);
  return l < 1e-3 ? 0 : Math.max(-0.9, Math.min(0.9, (dx * rx + dz * rz) / l * 0.9)); }
function spot(kind, E){ const K = AMBIENCE.kinds[kind] || {};
  if(kind === 'gull' && Math.random() < 0.75){ const b = flockBird('gull', E); if(b) return b; }
  if(kind === 'surf'){ let r = Math.hypot(E.x, E.z), ux = E.x / r, uz = E.z / r; if(!(r > 1)){ const a = Math.random() * 6.283; ux = Math.cos(a); uz = Math.sin(a); }
    const o = Math.max(0, fieldDepth(E.x, E.z)) + pickR(K.out); return { x:E.x + ux * o, y:(E.y || 0) + pickR(K.h), z:E.z + uz * o }; }
  const a = Math.random() * 6.283, d = pickR(K.d || [15, 40]), x = E.x + Math.cos(a) * d, z = E.z + Math.sin(a) * d; return { x, y:heightAt(x, z) + pickR(K.h || [2, 8]), z }; }
function playCall(kind, P, why){ const a = actx, bank = AMB.bank[kind];
  if(!bank || !bank.length){ AMB.skipped.cold++; want(kind); return false; }
  if(AMB.live >= AMBIENCE.calls.max){ AMB.skipped.busy++; return false; }
  const C = AMBIENCE.calls, K = AMBIENCE.kinds[kind] || {}, E = ear(), d = Math.hypot(P.x - E.x, P.y - (E.y || 0), P.z - E.z), g = (K.g ?? 0.3) / (1 + d / C.ref);
  const src = a.createBufferSource(), gn = gainN(a, g), lp = filt(a, 'lowpass', Math.max(C.lp[0], C.lp[1] * Math.exp(-d / C.lp[2])));
  src.buffer = bank[Math.random() * bank.length | 0]; src.playbackRate.value = 1 + (Math.random() * 2 - 1) * C.detune; src.connect(gn).connect(lp); let node = lp, pn = null;
  if(a.createStereoPanner){ pn = a.createStereoPanner(); pn.pan.value = panOf(P.x, P.z); node.connect(pn); node = pn; }
  node.connect(AMB.bus); const ws = gainN(a, C.verb[0] + (C.verb[1] - C.verb[0]) * Math.min(1, d / C.verb[2])); node.connect(ws).connect(AMB.wet);   // far calls are mostly echo off the hills
  AMB.live++; src.onended = () => { AMB.live--; for(const n of [gn, lp, pn, ws]) if(n) try{ n.disconnect(); }catch(e){} }; src.start();
  AMB.fired[kind] = (AMB.fired[kind] | 0) + 1; AMB.log.push({ t:+(performance.now() / 1000).toFixed(2), kind, why, d:Math.round(d), g:+g.toFixed(3), heat:+AMB.heat.toFixed(2), mode:S.mode }); if(AMB.log.length > 60) AMB.log.shift();
  return true; }
function pickKind(set){ let sum = 0; for(const k in set) sum += set[k]; let r = Math.random() * sum; for(const k in set){ r -= set[k]; if(r <= 0) return k; } return null; }
function quiet(){ return AMB.calm >= AMBIENCE.heat.calm; }
// a call from the sky's own birds (world/skylife.js): swallows twitter as their flock sweeps by, a gull flock calls as it passes
export function ambienceCall(kind, x, y, z){ if(!AMB.bus || !ambienceOn() || !quiet()) return false; return playCall(kind, { x, y, z }, 'flock'); }

// ---------------------------------------------------------------- every frame ----------------------------------------------------------------
export function updateAmbience(dt, now){ const a = actx; if(!a || a.state !== 'running' || !master) return;
  const on = ambienceOn(), H = AMBIENCE.heat, Dk = AMBIENCE.duck, B = biomeAmb(), E = ear();
  // the fight's heat: every shot and blast as heard, the foes close by
  const hit = LOUD.shot + LOUD.big * Dk.big; AMB.heat = Math.min(1.5, AMB.heat * Math.exp(-dt / H.tau) + LOUD.shot * H.shot + LOUD.big * H.boom);
  if(hit > 0) AMB.duck = Math.max(Dk.min, Math.min(AMB.duck, 1 - Dk.depth * hit)); else AMB.duck += (1 - AMB.duck) * (1 - Math.exp(-dt / Dk.release));
  LOUD.shot = 0; LOUD.big = 0;
  if((AMB.foeT -= dt) <= 0){ AMB.foeT = 0.5; let n = 0; if(S.mode === 'playing'){ const r2 = H.near * H.near; for(const e of enemies) if(e.pos && (e.pos.x - E.x) ** 2 + (e.pos.z - E.z) ** 2 < r2) n++; } AMB.foes = Math.min(H.foeMax, n * H.perFoe); }
  const heat = S.mode === 'playing' || S.mode === 'dying' ? Math.max(Math.min(1, AMB.heat), AMB.foes) : 0;
  AMB.calm = heat < H.quiet ? AMB.calm + dt : 0;
  if(!on){ if(AMB.bus && AMB.sent !== 0){ AMB.bus.gain.setTargetAtTime(0, a.currentTime, 0.4); AMB.wet.gain.setTargetAtTime(0, a.currentTime, 0.4); AMB.sent = 0; AMB.offT = now; }
    if(AMB.bed && now - AMB.offT > 2){ dropBed(AMB.bed); AMB.bed = null; } return; }
  if(!AMB.bus){ AMB.bus = gainN(a, 0); AMB.bus.connect(master); AMB.wet = gainN(a, 0); if(verbSend) AMB.wet.connect(verbSend); }
  // a new field (or the layer back on): the loops and this field's calls are rendered in idle slices; the bed swaps over, the first call comes a few s in
  if(AMB.key !== BIOME.name + '|' + S.tod){ AMB.key = BIOME.name + '|' + S.tod; AMB.nextAt = now + pickR(AMBIENCE.calls.first); AMB.answerAt = 0;
    for(const k of ['pink', 'brown', 'rustle']) wantLoop(k); for(const k of Object.keys(Object.assign({}, B.day, B.night))) want(k); want('swallow'); want('gull');
    if(AMB.bed && AMB.bed.key !== BIOME.name){ dropBed(AMB.bed); AMB.bed = null; } }
  if(!AMB.bed && AMB.bufs.pink && AMB.bufs.brown && AMB.bufs.rustle) AMB.bed = buildBed(a, B);
  if(AMB.bed && (AMB.tick -= dt) <= 0){ AMB.tick = 0.1; stirBed(a, AMB.bed, B, E, now); }
  // the layer's level: the lull (the fight's heat, a menu, a pause) × the duck × under the radio's voice
  const L = AMBIENCE.lull, lull = PLAYISH[S.mode] || S.mode === 'dying' ? 1 - (1 - L.fight) * sm(0.1, H.hot, heat) : S.mode === 'paused' ? L.pause : L.menu;
  const lvl = AMBIENCE.vol * lull * AMB.duck * (VOICE.playing ? Dk.voice : 1), t = a.currentTime;
  const drop = lvl < AMB.sent - 0.02; if(drop || (now - AMB.sentAt > 0.05 && Math.abs(lvl - AMB.sent) > 0.004) || now - AMB.sentAt > 0.5){ const tc = drop ? 0.03 : 0.25;   // (a dip at once, the rest ~20 times a second)
    AMB.bus.gain.setTargetAtTime(lvl, t, tc); AMB.wet.gain.setTargetAtTime(lvl, t, tc); AMB.sent = lvl; AMB.sentAt = now; }
  // now and then a call: only after the fight has stayed quiet a while, never over it; sometimes a second bird answers
  const W = AMBIENCE.wx[S.weather] || {}, set = S.tod === 'night' ? B.night : B.day, rate = (B.rate || 0) * (W.calls ?? 1);
  if(AMB.answerAt && now >= AMB.answerAt){ if(quiet()) playCall(AMB.answerKind, spot(AMB.answerKind, E), 'answer'); AMB.answerAt = 0; }
  if(now >= AMB.nextAt){ AMB.nextAt = now + (rate > 0 ? pickR(AMBIENCE.calls.gap) / rate : 20);
    const k = rate > 0 && set ? pickKind(set) : null;
    if(k){ if(!quiet()){ AMB.skipped.hot++; AMB.nextAt = now + 2 + Math.random() * 2; }
      else if(playCall(k, spot(k, E), 'call') && k !== 'surf' && Math.random() < AMBIENCE.calls.answer){ AMB.answerAt = now + pickR(AMBIENCE.calls.answerT); AMB.answerKind = k; } } } }
