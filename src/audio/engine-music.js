// audio/engine-music.js — DIESEL ENGINE + TRACK CLATTER (player): idle burble → roar under load; climbing a mound makes it SCREAM, coasting downhill it backs off
import { APPLE, BNZ, MOBILE, NOW, NZ, PROFILE, S, __set_musicBus, __set_musicSrc, __set_muted, __set_songBuf, actx, audio, composer, doResize, master, musicBus, musicSrc, muted, padCfg, padHaptic, renderer, setIcon, sfxLevel, shaper, songBuf, verbSend } from '../hub.js';

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
export function engineStop(){ const n=ENG.nodes; if(!n||!actx) return; n.out.gain.setTargetAtTime(0, actx.currentTime, 0.15); }
export function updateEngine(dt){
  const n=ENG.nodes, p=S.player; if(!n||!actx) return;
  const t=actx.currentTime, live = S.mode==='playing' && p && !muted;
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
  const a=audio(); if(!a || musicSrc) return;
  try{
    if(!songBuf) __set_songBuf(renderSong(a));
    if(!musicBus){ __set_musicBus(a.createGain()); musicBus.connect(master); } setMusicOn(PROFILE.music!==false);   // Z111 also syncs the HUD music button icon
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
