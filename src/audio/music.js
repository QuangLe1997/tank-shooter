// audio/music.js — Z161 ADAPTIVE BATTLE SCORE: five looped stems rendered offline (pad · war drums · bass ostinato · string spiccato · brass) that fade in with the fight, plus a theme for each general
import { BOSS_DEFS, BOSS_NEW, S, actx, boss, enemies, musicBus } from '../hub.js';

// D minor, 96 bpm, 8 bars: i – VI – iv – V (two bars each). Every stem is the same length so they loop locked together.
const BPM=96, BEAT=60/BPM, BARS=8, LEN=BEAT*4*BARS;
const CHORDS=[[50,53,57],[46,50,53],[43,46,50],[45,49,52]];          // Dm · Bb · Gm · A (midi, root position around D3)
const hz=n=>440*Math.pow(2,(n-69)/12);
// each general's motif: semitones over the chord root, four notes a bar (null = rest) — what you hear when it rolls in
export const BOSS_MOTIF = {
  bull:[0,0,3,0], tempest:[0,3,7,10], goliath:[0,null,-5,null], reaper:[0,1,0,-1], overlord:[0,7,12,7],
  inferno:[0,3,5,6], serpent:[0,1,3,1], thunder:[12,0,12,0],
};
export const SCORE = { ready:false, building:false, stems:{}, gains:{}, srcs:{}, t0:0, boss:null, bossBuf:{}, lvl:{ pad:0, drums:0, bass:0, strings:0, brass:0, boss:0 }, tick:0, heat:0 };
const STEMS=['pad','drums','bass','strings','brass'];

function noiseBuf(oc){ const b=oc.createBuffer(1, oc.sampleRate, oc.sampleRate), d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return b; }
function env(g, t, a, peak, d, sus){ g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t+a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus||0.0001), t+a+d); }
function osc(oc, type, f, t, dur, out, peak, a, detune){ const o=oc.createOscillator(), g=oc.createGain(); o.type=type; o.frequency.value=f; if(detune) o.detune.value=detune;
  env(g, t, a||0.005, peak, dur); o.connect(g).connect(out); o.start(t); o.stop(t+dur+(a||0)+0.05); return o; }
const BUILD = {
  pad(oc, out){ const lp=oc.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1000; lp.Q.value=0.6; lp.connect(out);
    CHORDS.forEach((ch,ci)=>{ const t=ci*8*BEAT, dur=8*BEAT;
      for(const n of [...ch, ch[0]-12]) for(const dt of [-7,7]){ const o=oc.createOscillator(), g=oc.createGain(), p=oc.createStereoPanner(); o.type='sawtooth'; o.frequency.value=hz(n); o.detune.value=dt; p.pan.value=dt/14;
        g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.045,t+1.4); g.gain.setValueAtTime(0.045,t+dur-1.0); g.gain.linearRampToValueAtTime(0.0001,t+dur); o.connect(g).connect(p).connect(lp); o.start(t); o.stop(t+dur+0.05); }
      const sub=oc.createOscillator(), sg=oc.createGain(); sub.type='sine'; sub.frequency.value=hz(ch[0]-24); sg.gain.setValueAtTime(0.0001,t); sg.gain.linearRampToValueAtTime(0.12,t+1); sg.gain.linearRampToValueAtTime(0.0001,t+dur); sub.connect(sg).connect(out); sub.start(t); sub.stop(t+dur+0.05); }); },
  drums(oc, out){ const N=noiseBuf(oc);
    const taiko=(t,v)=>{ const o=oc.createOscillator(), g=oc.createGain(); o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(42,t+0.3); env(g,t,0.004,0.9*v,0.55); o.connect(g).connect(out); o.start(t); o.stop(t+0.7);
      const s=oc.createBufferSource(), f=oc.createBiquadFilter(), sg=oc.createGain(); s.buffer=N; f.type='lowpass'; f.frequency.value=420; env(sg,t,0.002,0.35*v,0.18); s.connect(f).connect(sg).connect(out); s.start(t, Math.random()*0.5); s.stop(t+0.3); };
    const snare=(t,v)=>{ const s=oc.createBufferSource(), f=oc.createBiquadFilter(), g=oc.createGain(); s.buffer=N; f.type='bandpass'; f.frequency.value=1900; f.Q.value=0.8; env(g,t,0.002,0.22*v,0.16); s.connect(f).connect(g).connect(out); s.start(t, Math.random()*0.5); s.stop(t+0.25); osc(oc,'triangle',190,t,0.08,out,0.08*v); };
    const hat=(t,v)=>{ const s=oc.createBufferSource(), f=oc.createBiquadFilter(), g=oc.createGain(); s.buffer=N; f.type='highpass'; f.frequency.value=7500; env(g,t,0.001,0.05*v,0.04); s.connect(f).connect(g).connect(out); s.start(t, Math.random()*0.5); s.stop(t+0.08); };
    for(let b=0;b<BARS;b++){ const t0=b*4*BEAT;
      for(const [bt,v] of [[0,1],[1.5,0.6],[2,0.85],[3,0.7]]) taiko(t0+bt*BEAT, v);
      snare(t0+1*BEAT,0.8); snare(t0+3*BEAT,1); for(let e=0;e<8;e++) hat(t0+e*BEAT/2, e%2?0.6:1);
      if(b%4===3) for(let k=0;k<8;k++) snare(t0+3*BEAT+k*BEAT/8, 0.35+k*0.08);   // roll into the next phrase
      if(b===BARS-1){ taiko(t0+3.5*BEAT,1); taiko(t0+3.75*BEAT,1); } } },
  bass(oc, out){ const lp=oc.createBiquadFilter(), sh=oc.createWaveShaper(); lp.type='lowpass'; lp.frequency.value=520; lp.Q.value=2; const c=new Float32Array(256); for(let i=0;i<256;i++){ const x=i/128-1; c[i]=Math.tanh(x*2.2); } sh.curve=c; sh.connect(lp).connect(out);
    const pat=[0,0,12,0,0,7,0,12];
    CHORDS.forEach((ch,ci)=>{ for(let k=0;k<16;k++){ const t=ci*8*BEAT+k*BEAT/2; osc(oc,'sawtooth',hz(ch[0]-12+pat[k%8]),t,0.22,sh,0.3); } }); },
  strings(oc, out){ const bp=oc.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1300; bp.Q.value=0.7; bp.connect(out);
    CHORDS.forEach((ch,ci)=>{ const tones=[ch[0]+12, ch[1]+12, ch[2]+12, ch[0]+24]; for(let k=0;k<32;k++){ const t=ci*8*BEAT+k*BEAT/4, n=tones[[0,1,2,1,0,1,2,3][k%8]];
      osc(oc,'sawtooth',hz(n),t,0.1,bp,0.06,0.004,-5); osc(oc,'triangle',hz(n),t,0.1,bp,0.05,0.004,5); } }); },
  brass(oc, out, motif){ const lp=oc.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=1.2; lp.frequency.value=1400; lp.connect(out);
    CHORDS.forEach((ch,ci)=>{ for(const half of [0,1]){ const t=ci*8*BEAT+half*4*BEAT;   // a heavy chord stab at every bar line
        for(const n of [ch[0]-12, ch[0], ch[2]]) for(const dt of [-9,0,9]){ const o=oc.createOscillator(), g=oc.createGain(); o.type='sawtooth'; o.frequency.value=hz(n); o.detune.value=dt; env(g,t,0.03,0.05,1.1,0.012); g.gain.linearRampToValueAtTime(0.0001,t+BEAT*1.6); o.connect(g).connect(lp); o.start(t); o.stop(t+BEAT*1.7); }
        if(motif) motif.forEach((m,k)=>{ if(m==null) return; const tt=t+k*BEAT; const o=oc.createOscillator(), g=oc.createGain(), v=oc.createOscillator(), vg=oc.createGain(); o.type='sawtooth'; o.frequency.value=hz(ch[0]+12+m);
          v.frequency.value=5.5; vg.gain.value=4; v.connect(vg).connect(o.detune); env(g,tt,0.04,0.09,BEAT*0.85,0.03); g.gain.linearRampToValueAtTime(0.0001,tt+BEAT*0.95); o.connect(g).connect(lp); o.start(tt); v.start(tt); o.stop(tt+BEAT); v.stop(tt+BEAT); }); } }); },
};
function render(kind, motif){ const SR=Math.min(44100, (actx&&actx.sampleRate)||44100), oc=new OfflineAudioContext(2, Math.ceil(LEN*SR), SR), out=oc.createGain(); out.gain.value=1; out.connect(oc.destination);
  BUILD[kind](oc, out, motif); return oc.startRendering(); }

// build the stems once (async, a stem at a time so the game never hitches), then start them all locked to one clock
export async function buildScore(){ if(SCORE.ready || SCORE.building || !actx) return; SCORE.building=true;
  try{ for(const k of STEMS){ SCORE.stems[k]=await render(k); await new Promise(r=>setTimeout(r, 30)); } SCORE.ready=true; startStems(); }catch(e){ console.warn('score', e); } SCORE.building=false; }
function startStems(){ if(!musicBus || !SCORE.ready) return; const t=actx.currentTime+0.05; SCORE.t0=t;
  for(const k of STEMS){ if(SCORE.srcs[k]) continue; const g=SCORE.gains[k]||(SCORE.gains[k]=actx.createGain()); g.gain.value=0.0001; g.connect(musicBus);
    const s=actx.createBufferSource(); s.buffer=SCORE.stems[k]; s.loop=true; s.connect(g); s.start(t); SCORE.srcs[k]=s; } }
// the general's theme: rendered when the boss rolls in, joins on the shared clock
export async function bossTheme(id){ if(!actx || !SCORE.ready || SCORE.boss===id) return; SCORE.boss=id;
  try{ const buf=SCORE.bossBuf[id] || (SCORE.bossBuf[id]=await render('brass', BOSS_MOTIF[id]||BOSS_MOTIF.overlord)); if(SCORE.boss!==id) return;
    if(SCORE.srcs.boss){ try{ SCORE.srcs.boss.stop(); }catch(e){} } const g=SCORE.gains.boss||(SCORE.gains.boss=actx.createGain()); if(!SCORE.srcs.boss) { g.gain.value=0.0001; g.connect(musicBus); }
    const s=actx.createBufferSource(); s.buffer=buf; s.loop=true; s.connect(g); const off=((actx.currentTime-SCORE.t0)%LEN+LEN)%LEN; s.start(actx.currentTime, off); SCORE.srcs.boss=s; }catch(e){} }
export function preRenderBossThemes(){ if(!SCORE.ready) return; (async()=>{ for(const b of [...BOSS_DEFS, ...BOSS_NEW]){ if(!SCORE.bossBuf[b.id]) SCORE.bossBuf[b.id]=await render('brass', BOSS_MOTIF[b.id]); await new Promise(r=>setTimeout(r,200)); } })(); }
// called every frame: read the fight and fade the stems toward it
export function updateScore(dt){ if(!SCORE.ready || !actx) return; SCORE.tick-=dt; if(SCORE.tick>0) return; SCORE.tick=0.25;
  const p=S.player, play=S.mode==='playing', B=boss && boss.alive;
  let near=0; if(play && p) for(const e of enemies){ if(e.def && !e.def.inf && (e.pos.x-p.pos.x)**2+(e.pos.z-p.pos.z)**2 < 1600) near++; }
  const hurt = play && p ? 1-Math.max(0, Math.min(1, p.hp/p.maxHp)) : 0;
  const want = !play ? (S.mode==='countdown'||S.mode==='briefing' ? 0.25 : 0) : B ? 1 : Math.min(0.85, near/7 + hurt*0.35);
  SCORE.heat += (want-SCORE.heat)*(want>SCORE.heat?0.35:0.08);   // swell fast, settle slowly
  const h=SCORE.heat, L={ pad: play||S.mode==='countdown' ? 0.75 : 0.55, drums:Math.min(1,h*2.2), bass:h>0.3?Math.min(1,(h-0.3)*2.5):0, strings:h>0.55?Math.min(1,(h-0.55)*2.5):0, brass:B?0.55:(h>0.8?0.4:0), boss:B?1:0 };
  if(B && SCORE.boss!==boss.id) bossTheme(boss.id); if(!B && SCORE.boss){ SCORE.boss=null; }
  for(const k in L){ const g=SCORE.gains[k]; if(!g) continue; g.gain.setTargetAtTime(Math.max(0.0001, L[k]*(k==='pad'?0.9:1)), actx.currentTime, L[k]>SCORE.lvl[k]?0.6:1.4); SCORE.lvl[k]=L[k]; } }
