// audio/engine-music.js — DIESEL ENGINE + TRACK CLATTER (player): idle burble → roar under load; climbing a mound makes it SCREAM, coasting downhill it backs off
import { APPLE, BNZ, MOBILE, NOW, NZ, PROFILE, S, __set_musicBus, __set_musicSrc, __set_muted, __set_songBuf, actx, audio, buildScore, composer, doResize, master, musicBus, musicSrc, muted, padCfg, padHaptic, renderer, setIcon, sfxLevel, shaper, songBuf, verbSend, rideHealth } from '../hub.js';
import { RIDE } from '../../config.js';

// ---- DIESEL ENGINE + TRACK CLATTER (player): idle burble → roar under load; climbing a mound makes it SCREAM, coasting downhill it backs off ----
export const ENG={ on:false, nodes:null, rpm:0 };
export function engineStart(){
  const a=audio(); if(!a||ENG.nodes) return;
  const out=a.createGain(); out.gain.value=0; out.connect(master); if(verbSend){ const s=a.createGain(); s.gain.value=0.08; out.connect(s).connect(verbSend); }
  const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=380; lp.Q.value=1.2;
  const sh=a.createWaveShaper(); sh.curve=shaper?shaper.curve:null; sh.connect(lp).connect(out);
  const o1=a.createOscillator(); o1.type='sawtooth'; o1.frequency.value=32; const g1=a.createGain(); g1.gain.value=0.5; o1.connect(g1).connect(sh);
  const o2=a.createOscillator(); o2.type='square'; o2.frequency.value=16; const g2=a.createGain(); g2.gain.value=0.25; o2.connect(g2).connect(sh);            // firing-order lope
  const rb=a.createBufferSource(); rb.buffer=BNZ; rb.loop=true; const rbf=a.createBiquadFilter(); rbf.type='bandpass'; rbf.frequency.value=140; rbf.Q.value=0.8; const rbg=a.createGain(); rbg.gain.value=0.6; rb.connect(rbf).connect(rbg).connect(sh);
  const tk=a.createBufferSource(); tk.buffer=NZ; tk.loop=true; const tkf=a.createBiquadFilter(); tkf.type='bandpass'; tkf.frequency.value=1900; tkf.Q.value=1.1;   // track links clanking
  const tkg=a.createGain(); tkg.gain.value=0; const lfo=a.createOscillator(); lfo.type='square'; lfo.frequency.value=4; const lfg=a.createGain(); lfg.gain.value=0; lfo.connect(lfg).connect(tkg.gain);
  tk.connect(tkf).connect(tkg).connect(out);
  for(const n of [o1,o2,rb,tk,lfo]) n.start();
  ENG.nodes={ out, lp, o1, o2, tkg, lfo, lfg }; ENG.on=true;
}
export function updateEngine(dt){
  const n=ENG.nodes, p=S.player; if(!n||!actx) return;
  const t=actx.currentTime, live = S.mode==='playing' && p && !muted && !p.cav;   // Z245 no diesel in cavalry mode
  updateBikeEngine(dt, p, t);   // Z302 the ride's own engine
  if(!live){ n.out.gain.setTargetAtTime(0, t, 0.2); return; }
  const sp=Math.hypot(p.vel.x,p.vel.z), thr=Math.min(1, Math.abs(p.throttle||0)+(NOW()<p.dashUntil?1:0)), up=Math.max(0, p.grade||0), down=Math.max(0, -(p.grade||0));
  const load=Math.min(1.6, thr*(0.65+up*3.2) - down*0.5*thr + (NOW()<p.dashUntil?0.6:0));          // uphill = heavy load, downhill = engine braking
  ENG.rpm += ((0.18 + Math.max(0,load)*0.75 + sp/60) - ENG.rpm)*Math.min(1, dt*3);
  ENG.rpm = Math.max(0.1, Math.min(2, ENG.rpm||0.1));
  const f=26 + ENG.rpm*48;
  n.o1.frequency.setTargetAtTime(f, t, 0.05); n.o2.frequency.setTargetAtTime(f*0.5, t, 0.05);
  n.lp.frequency.setTargetAtTime(260 + ENG.rpm*1100, t, 0.08);
  n.out.gain.setTargetAtTime(0.07 + ENG.rpm*0.11, t, 0.08);
  n.lfo.frequency.setTargetAtTime(1 + sp*0.55, t, 0.1); n.lfg.gain.setTargetAtTime(Math.min(0.09, sp*0.004), t, 0.1);
}
// Z302 THE RIDE'S ENGINE: a small four-stroke single (the xe ôm's 100 cc; the ba gác's bigger, lower one). It fires
//   once every two turns, so the firing pulse IS the pitch: a lazy put-put at idle, a rising buzz through each gear, a drop as the next gear goes in
//   (the revs are where the speed sits inside the gear's band), a blip with the throttle, a scream in a wheelie; exhaust hiss pulsing with the bangs
// Z363 AN OLD, TIRED HONDA: each firing drawn as its own sound — a soft low thump down the exhaust (the pipe's ring), the puff of gas, the valve
//   tappets ticking between them (an old engine's clatter), the beats a touch uneven and one in sixteen gone weak (a worn plug) — sixteen firings
//   rendered once into a loop and played faster as the revs climb; the throttle opens the filter and lets the rasp of the exhaust through
export const ENGB={ nodes:null, rpm:0.18 };
export const CUB = { f0:12, n:16, weak:[11], jit:0.12, pipe:[92, 0.018, 0.7], body:[48, 0.03, 0.6], puff:[0.006, 0.35], tick:[0.0012, 0.12] };
export function cubLoop(a){ const C = CUB, sr = a.sampleRate, len = Math.round(sr * C.n / C.f0), buf = a.createBuffer(1, len, sr), d = buf.getChannelData(0); let r = 7;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647, tail = Math.round(sr * 0.08);
  for(let k = 0; k < C.n; k++){ const i0 = Math.round((k + (rnd() - 0.5) * C.jit) / C.f0 * sr), amp = C.weak.includes(k) ? 0.3 : 0.85 + rnd() * 0.25;
    for(let j = 0; j < tail; j++){ const t = j / sr, i = (i0 + j + len) % len;   // (wrapped: the loop is seamless)
      d[i] += amp * (Math.sin(6.2832 * C.pipe[0] * t) * Math.exp(-t / C.pipe[1]) * C.pipe[2] + Math.sin(6.2832 * C.body[0] * t) * Math.exp(-t / C.body[1]) * C.body[2] + (rnd() * 2 - 1) * Math.exp(-t / C.puff[0]) * C.puff[1]); }
    const it = Math.round((k + 0.5) / C.f0 * sr); for(let j = 0; j < sr * 0.005; j++){ const i = (it + j) % len; d[i] += (rnd() * 2 - 1) * C.tick[1] * Math.exp(-j / sr / C.tick[0]); } }   // the tappets
  let pk = 0; for(let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(d[i])); for(let i = 0; i < len; i++) d[i] *= 0.9 / (pk || 1); return buf; }
function bikeEngineStart(a){ const out=a.createGain(); out.gain.value=0; out.connect(master); if(verbSend){ const s=a.createGain(); s.gain.value=0.06; out.connect(s).connect(verbSend); }
  const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900; lp.Q.value=0.9; lp.connect(out);
  const src=a.createBufferSource(); src.buffer=cubLoop(a); src.loop=true; src.connect(lp);
  const nz=a.createBufferSource(); nz.buffer=NZ; nz.loop=true; const bp=a.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=900; bp.Q.value=0.8; const ng=a.createGain(); ng.gain.value=0; nz.connect(bp).connect(ng).connect(lp);
  src.start(); nz.start(); return (ENGB.nodes={ out, lp, src, bp, ng }); }
function updateBikeEngine(dt, p, t){ const CV=p && p.cav, H=CV && CV.H, D=H && H.drv, a=actx; if(!a) return;
  const on = S.mode==='playing' && !muted && CV && CV.mounted && H && H.bike && (!D || D.state==='ride' || D.state==='mount' || D.state==='pull');
  if(!on){ if(ENGB.nodes) ENGB.nodes.out.gain.setTargetAtTime(0, t, 0.25); return; }
  const n=ENGB.nodes || bikeEngineStart(a), G=RIDE.gears, v=Math.abs(H.v||0), g=D ? D.gear : G.filter(x=>v>x).length, lo=g ? G[g-1] : 0, hi=G[g] ?? G[G.length-1]*1.3;
  const thr=Math.max(0, D ? D.thr : 0), within=Math.min(1, Math.max(0, (v-lo)/Math.max(0.5, hi-lo))), big=H.bike==='bagac' ? 0.78 : 1;
  ENGB.rpm += ((0.18 + within*0.7 + thr*0.18 + (D && D.wheelT>0 ? 0.25 : 0)) - ENGB.rpm)*Math.min(1, dt*7);
  const f=(11 + Math.max(0, ENGB.rpm-0.18)*58)*big;   // firings a second: a lazy putt at idle (11: ~1300 rpm), ~65 at the top
  n.src.playbackRate.setTargetAtTime(f/CUB.f0, t, 0.04);
  n.lp.frequency.setTargetAtTime((650 + ENGB.rpm*2300 + thr*900)*big, t, 0.05); n.bp.frequency.setTargetAtTime(800 + ENGB.rpm*1200, t, 0.08); n.ng.gain.setTargetAtTime(0.015 + ENGB.rpm*0.05 + thr*0.05, t, 0.08);
  const cough = rideHealth(H) < 0.3 && Math.random() < dt*4;   // Z303 a worn engine misses and coughs
  n.out.gain.setTargetAtTime(cough ? 0.004 : 0.05 + ENGB.rpm*0.07 + thr*0.04, t, cough ? 0.01 : 0.06); }
// procedural driving loop (kick + bass + lead), rendered once into a buffer
export let _hapT=0;
export function haptic(ms){ padHaptic(ms); if(!MOBILE || !padCfg().phone || !navigator.vibrate) return;   // Z117 the controller rumbles too
  const t=performance.now(); if(t-_hapT<60) return; _hapT=t; try{ navigator.vibrate(Array.isArray(ms)?ms:Math.max(5,Math.round(ms))); }catch(e){} }   // device rumble (Android)
export function setMuted(m){ __set_muted(m); if(master) master.gain.value = m?0:sfxLevel(); const b=document.querySelector('#muteBtn .ic'); if(b) setIcon(b, m?'mute':'sound'); const bp=document.querySelector('#sndBtnP .ic'); if(bp) setIcon(bp, m?'mute':'sound'); const lp=document.getElementById('sndLblP'); if(lp) lp.textContent='ÂM THANH: '+(m?'TẮT':'BẬT'); }
export function setMusicOn(on){ if(musicBus) musicBus.gain.value = on?0.5:0; for(const b of document.querySelectorAll('#musBtn .ic, #musBtnP .ic')) setIcon(b, on?'music':'musicOff'); const l=document.getElementById('musLblP'); if(l) l.textContent='NHẠC NỀN: '+(on?'BẬT':'TẮT'); }                                  // music track on/off (independent of SFX)
// Touch devices get a PIXEL BUDGET rather than a fixed ratio: a big tablet at dpr 2 asks for ~4× an
// iPhone's fill rate and drops frames with the bloom pass on. Budget ≈1.8M drawn pixels (Z109 Apple: 2.4M, up to 2× → an iPhone
// draws at 2× instead of 1.5×, a third sharper; the FPS governor in game/loop.js still steps down if a phone can't hold 60), never below 1×.
export function dprCap(){ const d=devicePixelRatio||1; if(!MOBILE) return Math.max(1, Math.min(d, 2, Math.sqrt(2.2e6/Math.max(1, innerWidth*innerHeight))));   // Z150 desktop gets a pixel budget too: a full-screen Retina window at 2× is 4× the fill rate
  const px=Math.max(1, innerWidth*innerHeight); return Math.max(1, Math.min(d, APPLE?2:1.5, Math.sqrt((APPLE?2.4e6:1.8e6)/px))); }
export function setQuality(q){ S.dpr = q==='low' ? (MOBILE?0.8:1) : Math.min(dprCap(), PROFILE.perfDpr||9);   // Z150 start where the FPS governor settled last time → no stepping down in the first seconds of a battle   // explicit Low/High override (adaptive FPS may still lower High later)
  try{ renderer.setPixelRatio(S.dpr); composer.setPixelRatio?.(S.dpr); doResize(true); }catch(e){} }
export function startMusic(){
  const a=audio(); if(!a) return;
  try{
    if(!musicBus){ __set_musicBus(a.createGain()); musicBus.connect(master); } setMusicOn(PROFILE.music!==false);   // Z111 also syncs the HUD music button icon
    if(typeof OfflineAudioContext!=='undefined'){ buildScore(); return; }   // Z161 the adaptive battle score (the old one-loop song stays as a fallback)
    if(musicSrc) return;
    if(!songBuf) __set_songBuf(renderSong(a));
    __set_musicSrc(a.createBufferSource()); musicSrc.buffer=songBuf; musicSrc.loop=true; musicSrc.connect(musicBus); musicSrc.start();
  }catch(e){}
}
export function renderSong(a){
  const bpm=128, beat=60/bpm, bars=8, len=beat*4*bars, sr=a.sampleRate;
  const buf=a.createBuffer(2, Math.floor(len*sr), sr);
  const L=buf.getChannelData(0), R=buf.getChannelData(1);
  const addOsc=(t0,dur,freq,vol,type)=>{ const n0=Math.floor(t0*sr), n1=Math.floor((t0+dur)*sr);
    for(let i=n0;i<n1 && i<L.length;i++){ const tt=(i-n0)/sr, env=Math.min(1,tt*60)*Math.exp(-tt*5/dur);
      let w; const ph=freq*tt*2*Math.PI;
      w = type==='saw' ? (2*((freq*tt)%1)-1) : type==='sq' ? (Math.sin(ph)>0?1:-1) : Math.sin(ph);
      const v=w*vol*env; L[i]+=v; R[i]+=v; } };
  const addKick=(t0)=>{ const n0=Math.floor(t0*sr),dur=0.18,n1=Math.floor((t0+dur)*sr);
    for(let i=n0;i<n1 && i<L.length;i++){ const tt=(i-n0)/sr, f=120*Math.exp(-tt*18)+45, env=Math.exp(-tt*8);
      const v=Math.sin(f*tt*2*Math.PI)*0.5*env; L[i]+=v; R[i]+=v; } };
  const addHat=(t0)=>{ const n0=Math.floor(t0*sr),dur=0.04,n1=Math.floor((t0+dur)*sr);
    for(let i=n0;i<n1 && i<L.length;i++){ const tt=(i-n0)/sr, env=Math.exp(-tt*60); const v=(Math.random()*2-1)*0.12*env; L[i]+=v; R[i]+=v; } };
  // A minor-ish driving bassline + lead motif
  const bass=[55,55,82.4,55, 49,49,73.4,49];   // per bar root
  const lead=[440,523,659,587, 523,440,392,440];
  for(let bar=0;bar<bars;bar++){
    const bt=bar*beat*4;
    for(let b=0;b<4;b++){ addKick(bt+b*beat); addHat(bt+b*beat+beat*0.5);
      addOsc(bt+b*beat, beat*0.9, bass[bar]* (b%2?1:1), 0.16, 'saw'); }
    // lead every 2 bars
    if(bar%1===0){ for(let s=0;s<4;s++) addOsc(bt+s*beat, beat*0.5, lead[(bar+s)%lead.length], 0.07, 'sq'); }
  }
  return buf;
}
