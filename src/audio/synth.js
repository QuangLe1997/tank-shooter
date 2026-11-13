// audio/synth.js — AUDIO (Web Audio synth)
import * as THREE from 'three';
import { PROFILE, S, VIEW, worldToScreen } from '../hub.js';

// ----------------------------- AUDIO (Web Audio synth) -----------------------------
export let actx=null, master=null, musicBus=null, musicSrc=null, songBuf=null, muted=false;
// ---- AUDIO ENGINE: compressor master + outdoor convolution reverb send, shared noise buffers, positional voices ----
export let comp=null, verb=null, verbSend=null, NZ=null, BNZ=null, shaper=null, _bus=null, duck=null, limiter=null;
// Z151 the effects level the player picked (TẮT / NHỎ / VỪA / LỚN) → master gain
export const SFX_LEVELS={ low:0.32, mid:0.5, high:0.68 };
export function sfxLevel(){ return SFX_LEVELS[(PROFILE && PROFILE.sfxVol)||'mid']||0.5; }
export function audio(){
  if(!actx){ try{ actx=new (window.AudioContext||window.webkitAudioContext)();
    master=actx.createGain(); master.gain.value=muted?0:sfxLevel();
    // Z151 EAR-SAFE MASTER: a gentle shelf takes the fizz off 6 kHz+ (where long sessions start to hurt), a soft glue compressor,
    //   then a brick-wall limiter so a pile-up of blasts can never clip into harsh digital distortion
    const shelf=actx.createBiquadFilter(); shelf.type='highshelf'; shelf.frequency.value=6500; shelf.gain.value=-3.5;
    comp=actx.createDynamicsCompressor(); comp.threshold.value=-18; comp.knee.value=10; comp.ratio.value=3; comp.attack.value=0.004; comp.release.value=0.25;
    limiter=actx.createDynamicsCompressor(); limiter.threshold.value=-3; limiter.knee.value=0; limiter.ratio.value=20; limiter.attack.value=0.001; limiter.release.value=0.12;
    master.connect(shelf).connect(comp).connect(limiter).connect(actx.destination);
    duck=actx.createGain(); duck.gain.value=1; duck.connect(master);   // small arms / impacts / clicks ride this bus: it dips under a big blast so the blast lands
    const sr=actx.sampleRate;
    NZ=actx.createBuffer(1, sr*2, sr); { const d=NZ.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }                       // white
    BNZ=actx.createBuffer(1, sr*2, sr); { const d=BNZ.getChannelData(0); let l=0; for(let i=0;i<d.length;i++){ l=(l+0.02*(Math.random()*2-1))/1.02; d[i]=l*3.5; } }   // brown (rumble)
    const L=Math.floor(sr*2.2), ir=actx.createBuffer(2, L, sr);                                                                          // outdoor IR: sparse early slap-back + soft diffuse tail
    for(let c=0;c<2;c++){ const d=ir.getChannelData(c); let lp=0; for(let i=0;i<L;i++){ const t=i/sr; lp+= ((Math.random()*2-1) - lp)*0.18; d[i]=lp*Math.pow(1-t/2.2,3.2)*0.9; }
      for(const [t,a] of [[0.018,0.42],[0.033,0.3],[0.052,0.26],[0.08,0.2],[0.12,0.16]]){ const k=Math.floor((t+c*0.006)*sr); d[k]+=a; }   // ground + nearby walls
      for(const [t,a] of [[0.34,0.18],[0.62,0.11],[0.95,0.07],[1.4,0.04]]){ const k0=Math.floor((t+c*0.013)*sr); let l2=0; for(let j=0;j<Math.floor(0.05*sr);j++){ l2+=((Math.random()*2-1)-l2)*0.06; d[k0+j]+=l2*a*Math.exp(-j/(0.012*sr))*3; } } }   // rolling echoes off distant hills (dull, low-passed)
    verb=actx.createConvolver(); verb.buffer=ir; verbSend=actx.createGain(); verbSend.gain.value=0.32; verbSend.connect(verb).connect(master);
    setTimeout(()=>warmSounds(), 0);   // Z102 fill the sound bank in small slices after the first gesture
    shaper=actx.createWaveShaper(); { const n=1024, cu=new Float32Array(n); for(let i=0;i<n;i++){ const x=i/n*2-1; cu[i]=Math.tanh(x*2.6); } shaper.curve=cu; }
  }catch(e){} }
  if(actx && actx.state==='suspended'){ try{ actx.resume(); }catch(e){} }
  return actx;
}
// a voice = gain → (pan) → lowpass(distance) → master (+ reverb send); returns its input node
export function voice(pos, wet){
  const a=audio(); if(!a) return null; const g=a.createGain(); let out=g;
  if(pos && S.player){ const dx=pos.x-S.player.pos.x, dz=pos.z-S.player.pos.z, d=Math.hypot(dx,dz);
    g.gain.value = 1/(1+d/24);
    const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=Math.max(650, 17000*Math.exp(-d/32)); out.connect(lp); out=lp;      // far = muffled
    if(a.createStereoPanner){ const sp=worldToScreen(new THREE.Vector3(pos.x,1,pos.z)); const pn=a.createStereoPanner(); pn.pan.value=Math.max(-0.85,Math.min(0.85,(sp.x/VIEW.w-0.5)*1.6)); out.connect(pn); out=pn; }
    wet = (wet||0.3)*(1+Math.min(1.2,d/40)); }                                                                                       // distant shots are mostly echo
  out.connect(duck||master); if(verbSend){ const s=a.createGain(); s.gain.value=wet==null?0.3:wet; out.connect(s).connect(verbSend); }
  return g;
}
export function tone(freq, dur, {type='sine', vol=0.2, delay=0, slideTo=null, bus=null}={}){
  const a=audio(); if(!a) return;
  const t0=a.currentTime+delay; const o=a.createOscillator(), g=a.createGain();
  o.type=type; o.frequency.setValueAtTime(freq,t0);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1,slideTo), t0+dur);
  g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(vol,t0+0.006);
  g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  o.connect(g).connect(bus||_bus||duck||master||a.destination); o.start(t0); o.stop(t0+dur+0.03);
}
// noise burst through a filter (shared buffer, random offset) — type: 'bp' band, 'lp' low, 'hp' high; brown=true for rumble
export function noise(dur, {vol=0.2, delay=0, hp=400, lp=8000, type='bp', brown=false, bus=null, sweepTo=null, attack=0.004, dist=false}={}){
  const a=audio(); if(!a||!NZ) return; const t0=a.currentTime+delay;
  const src=a.createBufferSource(); src.buffer=brown?BNZ:NZ; src.loop=true;
  const f=a.createBiquadFilter();
  if(type==='lp'){ f.type='lowpass'; f.frequency.value=lp; } else if(type==='hp'){ f.type='highpass'; f.frequency.value=hp; } else { f.type='bandpass'; f.frequency.value=(hp+lp)/2; f.Q.value=0.7; }
  if(sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40,sweepTo), t0+dur);
  const g=a.createGain(); g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(vol,t0+attack); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  let node=src.connect(f); if(dist && shaper){ const sh=a.createWaveShaper(); sh.curve=shaper.curve; node=node.connect(sh); }
  node.connect(g).connect(bus||_bus||duck||master||a.destination); src.start(t0, Math.random()*1.5); src.stop(t0+dur+0.05);
}
// ===================================================================================================================
// Z102 · SOUND BANK — physically-modelled one-shots, rendered once into AudioBuffers (no sample files, still zero-build).
//   • muzzle BLAST = Friedlander pressure wave (instant rise, exponential decay, negative suction phase) — the "boom" ears expect
//   • supersonic CRACK = a sub-millisecond N-wave · mechanism = modal clicks (damped inharmonic partials of small steel parts)
//   • armour IMPACTS / hull COLLISIONS = modal synthesis of steel plates (partials 1 · 2.76 · 5.40 · 8.93) + spall/scrape noise
//   • EXPLOSIONS = blast wave + brown-noise rumble + debris rain + dirt patter; size scales length and pitch
//   • every sound has 4 variants and is played with ±5% pitch / ±10% gain jitter → automatic fire never sounds like a loop
//   • distance: gain falloff, air-absorption low-pass and the speed of sound (far blasts arrive after the flash)
// ===================================================================================================================
const SR=()=> (actx?actx.sampleRate:44100);
function _bq(x, type, f, q){                                    // RBJ biquad over a Float32Array (in place)
  const sr=SR(), w=2*Math.PI*Math.min(f, sr*0.45)/sr, cs=Math.cos(w), sn=Math.sin(w), al=sn/(2*(q||0.707)); let b0,b1,b2,a0,a1,a2;
  if(type==='lp'){ b0=(1-cs)/2; b1=1-cs; b2=(1-cs)/2; } else if(type==='hp'){ b0=(1+cs)/2; b1=-(1+cs); b2=(1+cs)/2; } else { b0=al; b1=0; b2=-al; }
  a0=1+al; a1=-2*cs; a2=1-al; b0/=a0; b1/=a0; b2/=a0; a1/=a0; a2/=a0;
  let x1=0,x2=0,y1=0,y2=0; for(let i=0;i<x.length;i++){ const v=x[i], y=b0*v+b1*x1+b2*x2-a1*y1-a2*y2; x2=x1; x1=v; y2=y1; y1=y; x[i]=y; } return x; }
function _buf(sec){ return new Float32Array(Math.max(1, Math.floor(sec*SR()))); }
function _add(dst, src, at, g){ const o=Math.floor((at||0)*SR()); for(let i=0;i<src.length && o+i<dst.length;i++) dst[o+i]+=src[i]*(g==null?1:g); return dst; }
function _noise(sec, env){ const x=_buf(sec), n=x.length; for(let i=0;i<n;i++) x[i]=(Math.random()*2-1)*env(i/SR(), i/n); return x; }
function _brown(sec, env){ const x=_buf(sec), n=x.length; let l=0; for(let i=0;i<n;i++){ l=(l+0.02*(Math.random()*2-1))/1.02; x[i]=l*3.5*env(i/SR(), i/n); } return x; }
function _friedlander(sec, T, k){ const x=_buf(sec), sr=SR(), rise=Math.max(2, Math.floor(0.00025*sr)); for(let i=0;i<x.length;i++){ const t=i/sr; let v=(1-t/T)*Math.exp(-k*t/T); if(i<rise) v*=i/rise; x[i]=v; } return x; }
function _modal(sec, f0, ratios, decays, amps, jit){ const x=_buf(sec), sr=SR(); const P=ratios.map((r,i)=>({ w:2*Math.PI*f0*r*(1+(Math.random()-0.5)*(jit||0.02)), d:decays[i], a:amps[i], ph:Math.random()*6.28 }));
  for(let i=0;i<x.length;i++){ const t=i/sr; let v=0; for(const p of P) v+=p.a*Math.exp(-t/p.d)*Math.sin(p.w*t+p.ph); x[i]=v; } return x; }
function _sat(x, drive){ for(let i=0;i<x.length;i++) x[i]=Math.tanh(x[i]*drive)/Math.tanh(drive); return x; }
function _norm(x, peak){ let m=1e-6; for(let i=0;i<x.length;i++) m=Math.max(m, Math.abs(x[i])); const k=(peak||0.9)/m; for(let i=0;i<x.length;i++) x[i]*=k; return x; }
const PLATE=[1, 2.76, 5.40, 8.93, 13.34];                        // free steel plate modes
// --- recipes: each returns a mono Float32Array ---
function rGun(o){                                                // o: { T blast length (s), k decay, lp body cutoff, crack, mech, tail, sub }
  const len=o.len||0.6, x=_buf(len);
  _add(x, _bq(_friedlander(len, o.T, o.k||5), 'lp', o.lp||3000), 0, 1.0);                                      // muzzle blast (pressure wave)
  _add(x, _bq(_noise(o.T*6+0.05, (t)=>Math.exp(-t/(o.T*1.6+0.01))), 'lp', (o.lp||3000)*1.4), 0, 0.55);          // propellant gas turbulence
  if(o.crack) _add(x, _bq(_bq(_noise(0.004, (t,u)=>1-u), 'hp', 2200), 'lp', 7000), 0, o.crack);   // Z151 band-limited: the snap stays, the fizz goes                                  // supersonic crack (N-wave snap)
  if(o.sub) _add(x, _modal(o.T*14+0.1, o.subF||55, [1], [o.T*4+0.05], [1]), 0, o.sub);                          // chest thump
  if(o.tail) _add(x, _bq(_brown(len, (t)=>Math.exp(-t/(o.tail))), 'lp', 700), 0.004, 0.5);                      // ground-reflected rumble
  if(o.mech) _add(x, _modal(0.06, o.mech, PLATE, [0.012,0.008,0.006,0.004,0.003], [1,0.6,0.4,0.25,0.15], 0.06), o.mechAt||0.03, 0.18);   // bolt / breech click
  if(o.ring) _add(x, _modal(len, o.ring, [1,2.76,5.4], [0.35,0.18,0.08], [0.6,0.3,0.15], 0.01), 0.002, 0.05);    // barrel ring (big guns)
  return _norm(_sat(x, o.drive||2.2), 0.95); }
function rExplosion(size){                                       // size 0.6 (grenade) … 1.6 (fuel dump / boss)
  const len=1.2+size*1.6, x=_buf(len), T=0.006+size*0.012;
  _add(x, _bq(_friedlander(len, T, 4), 'lp', 1800/size), 0, 1.0);                                                // blast wave
  _add(x, _bq(_brown(len, (t)=>Math.exp(-t/(0.35+size*0.5))*(1-Math.exp(-t/0.01))), 'lp', 420), 0.01, 1.1);     // rolling rumble
  _add(x, _bq(_noise(0.4, (t)=>Math.exp(-t/0.07)), 'lp', 3800), 0, 0.5);                                         // fireball roar crack
  for(let i=0;i<Math.round(18*size);i++){ const at=0.08+Math.random()*(0.5+size*0.6); _add(x, _bq(_noise(0.012+Math.random()*0.02, (t,u)=>1-u), 'hp', 1500+Math.random()*4000), at, (0.08+Math.random()*0.12)); }   // debris & dirt rain
  for(let i=0;i<Math.round(4*size);i++) _add(x, _modal(0.12, 300+Math.random()*900, PLATE, [0.05,0.03,0.02,0.012,0.008], [1,.5,.3,.2,.1], 0.05), 0.3+Math.random()*(0.6+size), 0.06);   // metal fragments landing
  return _norm(_sat(x, 1.8), 0.95); }
function rImpactMetal(heavy){                                    // a round slapping armour plate (+ spall)
  const len=heavy?0.5:0.28, x=_buf(len), f0=heavy?190:420+Math.random()*180;
  _add(x, _modal(len, f0, PLATE, heavy?[0.18,0.1,0.06,0.03,0.02]:[0.09,0.05,0.03,0.018,0.01], [1,0.7,0.5,0.3,0.2], 0.03), 0, 0.7);
  _add(x, _bq(_noise(0.05, (t)=>Math.exp(-t/0.012)), 'hp', 1800), 0, 0.8);                                       // spall crack
  if(heavy) _add(x, _bq(_friedlander(len, 0.004, 5), 'lp', 900), 0, 0.6);
  return _norm(_sat(x, 1.6), 0.9); }
function rRicochet(){ const len=0.45, x=_buf(len), sr=SR(); let ph=0; const f0=1500+Math.random()*1100, f1=f0*0.55;   // Z151 an octave lower: still a whine, no longer a needle   // whining ricochet with Doppler drop
  for(let i=0;i<x.length;i++){ const t=i/sr, u=t/len, f=f0+(f1-f0)*u; ph+=2*Math.PI*f/sr; x[i]=Math.sin(ph)*Math.exp(-t/0.14)*(t<0.004?t/0.004:1)*(0.85+0.15*Math.sin(t*90)); }
  _add(x, _bq(_noise(0.03, (t)=>Math.exp(-t/0.008)), 'hp', 2500), 0, 0.7); return _norm(x, 0.7); }
function rCollision(){                                           // 50 t of steel meeting steel: low hull modes + crunch + scrape
  const len=0.9, x=_buf(len);
  _add(x, _modal(len, 62+Math.random()*20, PLATE, [0.32,0.2,0.12,0.07,0.05], [1,0.8,0.55,0.35,0.2], 0.04), 0, 0.9);
  _add(x, _modal(len, 260+Math.random()*80, PLATE, [0.15,0.09,0.05,0.03,0.02], [1,0.6,0.4,0.25,0.15], 0.05), 0.004, 0.45);
  _add(x, _bq(_friedlander(len, 0.008, 4), 'lp', 600), 0, 0.8);
  _add(x, _bq(_noise(0.45, (t)=>Math.exp(-t/0.12)*(0.6+0.4*Math.sin(t*140))), 'bp', 1400, 0.8), 0.01, 0.35);    // grinding scrape
  return _norm(_sat(x, 2), 0.95); }
function rThud(){ const len=0.45, x=_buf(len); _add(x, _bq(_friedlander(len, 0.012, 4), 'lp', 380), 0, 1); _add(x, _bq(_brown(0.4,(t)=>Math.exp(-t/0.09)), 'lp', 600), 0, 0.6);
  _add(x, _bq(_noise(0.2,(t)=>Math.exp(-t/0.05)), 'bp', 900, 0.9), 0.01, 0.25); return _norm(x, 0.9); }
function rCrunch(){ const len=0.3, x=_buf(len); for(let i=0;i<14;i++) _add(x, _bq(_noise(0.01+Math.random()*0.02,(t,u)=>1-u), 'bp', 500+Math.random()*1500, 1.2), Math.random()*0.18, 0.3+Math.random()*0.4);
  _add(x, _bq(_brown(0.25,(t)=>Math.exp(-t/0.06)), 'lp', 500), 0, 0.5); return _norm(x, 0.8); }
function rLaunch(){ const len=1.1, x=_buf(len); _add(x, _bq(_friedlander(len, 0.01, 5), 'lp', 1200), 0, 0.8);
  _add(x, _bq(_bq(_noise(1.0,(t)=>Math.min(1,t/0.03)*Math.exp(-t/0.45)), 'lp', 2600), 'hp', 180), 0.005, 0.75);           // Z151 rocket motor roar (was a 1.6 kHz hiss)
  _add(x, _bq(_brown(1.0,(t)=>Math.exp(-t/0.35)), 'lp', 300), 0, 0.6); return _norm(_sat(x,1.8), 0.9); }
function rReload(){ const len=0.5, x=_buf(len); _add(x, _modal(0.08, 700, PLATE, [0.02,0.012,0.008,0.005,0.004], [1,.6,.4,.25,.15], 0.05), 0, 0.6);
  _add(x, _modal(0.12, 320, PLATE, [0.05,0.03,0.02,0.012,0.008], [1,.6,.4,.25,.15], 0.05), 0.17, 0.7); _add(x, _bq(_noise(0.04,(t)=>Math.exp(-t/0.01)),'bp',2500,1), 0.17, 0.4); return _norm(x, 0.8); }
// sound definitions: recipe + variants + base gain + rate-limit (seconds between starts) + voice priority
export const SND = {   // Z151 re-levelled by measurement (K-weighted momentary loudness): heroes (blasts, big guns) on top, automatic fire −23 LU as a stream, impacts well under
  rifle:   { r:()=>rGun({T:0.0024, k:5, lp:3600, crack:0.35, mech:900, sub:0.4, subF:110, tail:0.12, len:0.55}), g:0.40, gap:0.035 },          // 30 mm autocannon
  mg:      { r:()=>rGun({T:0.0016, k:5, lp:3600, crack:0.35, sub:0.28, subF:130, tail:0.08, len:0.4}), g:0.31, gap:0.03 },                       // 14.5 mm HMG
  minigun: { r:()=>rGun({T:0.0012, k:6, lp:3800, crack:0.28, sub:0.2, subF:150, tail:0.05, len:0.28}), g:0.25, gap:0.02 },                    // rotary: a ripping buzz
  shotgun: { r:()=>rGun({T:0.0045, k:4, lp:1800, crack:0.2, sub:0.6, subF:70, tail:0.25, len:0.9, drive:2.6}), g:0.77, gap:0.08, big:1 },
  flak:    { r:()=>rGun({T:0.0026, k:5, lp:3000, crack:0.35, mech:640, sub:0.4, subF:100, tail:0.14, len:0.6}), g:0.55, gap:0.04 },
  agl:     { r:()=>rGun({T:0.004, k:4, lp:1100, crack:0, mech:520, sub:0.55, subF:80, tail:0.12, len:0.5}), g:0.34, gap:0.05 },                  // 40 mm: hollow thoomp
  cannon:  { r:()=>rGun({T:0.009, k:4, lp:1500, crack:0.35, sub:1.0, subF:48, tail:0.55, ring:170, len:1.8, drive:2.8}), g:0.9, gap:0.1, big:1 },        // 120 mm
  hesh:    { r:()=>rGun({T:0.0075, k:4, lp:1400, crack:0.3, sub:0.9, subF:55, tail:0.45, ring:210, len:1.5, drive:2.6}), g:0.87, gap:0.1, big:1 },
  enemy:   { r:()=>rGun({T:0.005, k:4.5, lp:1700, crack:0.25, sub:0.5, subF:75, tail:0.3, len:1.0}), g:0.45, gap:0.04 },                          // enemy tank guns
  rifleE:  { r:()=>rGun({T:0.0011, k:6, lp:3400, crack:0.4, sub:0.08, subF:200, tail:0.06, len:0.3}), g:0.30, gap:0.03 },                     // infantry carbines
  launch:  { r:rLaunch, g:0.36, gap:0.08 },
  boom:    { r:()=>rExplosion(0.75), g:0.70, gap:0.05, big:1 },
  bigboom: { r:()=>rExplosion(1.45), g:0.90, gap:0.09, big:1 },
  hitM:    { r:()=>rImpactMetal(false), g:0.22, gap:0.06 },
  hitH:    { r:()=>rImpactMetal(true), g:0.32, gap:0.07 },
  ricochet:{ r:rRicochet, g:0.2, gap:0.2 },
  clang:   { r:rCollision, g:0.32, gap:0.18 },
  thud:    { r:rThud, g:0.85, gap:0.08 },
  crunch:  { r:rCrunch, g:0.34, gap:0.06 },
  reload:  { r:rReload, g:0.5, gap:0.2 },
};
const BANK={}, _lastAt={}; let _voices=0;
export function bankGet(k){ const D=SND[k]; if(!D||!actx) return null; let L=BANK[k]; if(!L){ L=BANK[k]=[]; }
  if(L.length<4){ const data=D.r(); const b=actx.createBuffer(1, data.length, actx.sampleRate); b.copyToChannel(data,0); L.push(b); return b; }   // build variants lazily, one per call
  return L[(Math.random()*L.length)|0]; }
export function warmSounds(){ if(!actx) return; const keys=Object.keys(SND); let i=0; const step=()=>{ const t0=performance.now(); while(i<keys.length*4 && performance.now()-t0<8){ bankGet(keys[i%keys.length]); i++; } if(i<keys.length*4) setTimeout(step, 30); }; setTimeout(step, 50); }   // fill the bank in 8 ms slices
// play a bank sound in the world: distance gain + air absorption + pan + SPEED OF SOUND delay; vol scales intensity (e.g. impact force)
export function play(k, pos, vol){
  const a=audio(); if(!a||muted) return; const D=SND[k]; if(!D) return;
  const now=a.currentTime; if(_lastAt[k]!=null && now-_lastAt[k] < D.gap) return; _lastAt[k]=now;
  if(_voices>28) return;                                                         // voice cap: keeps phones smooth under heavy fire
  const buf=bankGet(k); if(!buf) return;
  const src=a.createBufferSource(); src.buffer=buf; src.playbackRate.value=0.95+Math.random()*0.1;
  let delay=0, g=D.g*(vol==null?1:Math.max(0.15,Math.min(1.6,vol)))*(0.9+Math.random()*0.2);
  const out=a.createGain(); let node=out;
  if(pos && S.player){ const dx=pos.x-S.player.pos.x, dz=pos.z-S.player.pos.z, d=Math.hypot(dx,dz);
    g*=1/(1+d/22); delay=d/343*1.6;                                                // 1 unit ≈ 1.6 m: far blasts land a beat after the flash
    const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=Math.max(500, 18000*Math.exp(-d/28)); node.connect(lp); node=lp;
    if(a.createStereoPanner){ const sp=worldToScreen(new THREE.Vector3(pos.x,1,pos.z)); const pn=a.createStereoPanner(); pn.pan.value=Math.max(-0.85,Math.min(0.85,(sp.x/VIEW.w-0.5)*1.6)); node.connect(pn); node=pn; } }
  out.gain.value=g; src.connect(out); node.connect(D.big ? master : (duck||master));
  if(D.big && duck && (!pos || !S.player || Math.hypot(pos.x-S.player.pos.x, pos.z-S.player.pos.z) < 40)){ const t=now+delay; duck.gain.cancelScheduledValues(t); duck.gain.setTargetAtTime(0.5, t, 0.008); duck.gain.setTargetAtTime(1, t+0.09, 0.22); }   // Z151 side-chain duck: the boom punches through instead of being louder
  if(verbSend){ const s=a.createGain(); const d=pos&&S.player?Math.hypot(pos.x-S.player.pos.x,pos.z-S.player.pos.z):0; s.gain.value=Math.min(0.9, 0.22+d/70); node.connect(s).connect(verbSend); }   // distant = mostly echo
  _voices++; src.onended=()=>{ _voices--; try{ out.disconnect(); }catch(e){} };
  src.start(now+delay);
}
export function sfx(name, pos, vol){
  if(muted) return;
  switch(name){                                                   // Z102 world sounds → physically-modelled bank
    case 'shoot': case 'shoot_rifle': return play('rifle', pos, vol);
    case 'shoot_smg': return play('mg', pos, vol);
    case 'shoot_minigun': return play('minigun', pos, vol);
    case 'shoot_shotgun': return play('shotgun', pos, vol);
    case 'shoot_flak': return play('flak', pos, vol);
    case 'shoot_agl': return play('agl', pos, vol);
    case 'shoot_cannon': return play('cannon', pos, vol);
    case 'shoot_hesh': return play('hesh', pos, vol);
    case 'shoot_thermo': play('launch', pos, vol); return play('hesh', pos, 0.6);
    case 'shoot_missile': return play('launch', pos, (vol||1)*0.8);
    case 'rocketlaunch': return play('launch', pos, vol);
    case 'enemyShoot': return play('enemy', pos, vol);
    case 'rifleShot': return play('rifleE', pos, vol);
    case 'explode': return play('boom', pos, vol);
    case 'bigexplode': return play('bigboom', pos, vol);
    case 'hit': return play(Math.random()<0.12?'ricochet':'hitM', pos, vol);
    case 'hitHeavy': return play('hitH', pos, vol);
    case 'ricochet': return play('ricochet', pos, vol);
    case 'clang': return play('clang', pos, vol);
    case 'thud': return play('thud', pos, vol);
    case 'crunch': return play('crunch', pos, vol);
    case 'reload': return play('reload', null, vol);
  }
  const UI = name==='click'||name==='beep'||name==='wave'||name==='powerup'||name==='levelup'||name==='alarm';
  const bus = UI ? null : voice(pos||null, pos?0.3:0.22); _bus = bus;
  switch(name){
    case 'shoot_railgun':tone(1600,0.2,{type:'triangle',vol:0.07,slideTo:220}); noise(0.05,{vol:0.18,type:'bp',hp:1800,lp:6000,attack:0.001}); tone(90,0.3,{type:'sine',vol:0.3,slideTo:35}); noise(0.25,{vol:0.12,type:'bp',hp:300,lp:1500,delay:0.02}); break;
    case 'shoot_cryo':   noise(0.16,{vol:0.11,type:'bp',hp:1500,lp:5000,sweepTo:4500}); tone(900,0.12,{type:'sine',vol:0.05,slideTo:1600}); break;
    case 'shoot_tesla':  noise(0.12,{vol:0.12,type:'bp',hp:900,lp:4200,dist:true}); tone(120,0.15,{type:'sawtooth',vol:0.08,slideTo:60}); break;
    case 'hurt':    play('hitH', null, 1.1); noise(0.18,{vol:0.2,type:'lp',lp:1400,dist:true}); break;   // our own hull is struck: heavy plate + thump
    case 'corehit': tone(150,0.14,{type:'triangle',vol:0.16,slideTo:70}); break;
    case 'wave':    [523,659,784].forEach((f,i)=>tone(f,0.2,{type:'triangle',vol:0.14,delay:i*0.07})); break;
    case 'dash':    noise(0.3,{vol:0.2,type:'lp',lp:900,sweepTo:2400,brown:true}); tone(60,0.3,{type:'sawtooth',vol:0.08,slideTo:110}); break;   // engine surge
    case 'powerup': [659,988,1319].forEach((f,i)=>tone(f,0.18,{type:'triangle',vol:0.14,delay:i*0.05})); break;
    case 'levelup': [523,659,784,1047,1319].forEach((f,i)=>tone(f,0.24,{type:'triangle',vol:0.15,delay:i*0.08})); break;
    case 'spell':   tone(440,0.25,{type:'sine',vol:0.14,slideTo:1320}); break;
    case 'click':   tone(660,0.06,{type:'triangle',vol:0.09}); break;
    case 'reloaded':play('reload', null, 0.7); tone(1320,0.08,{type:'triangle',vol:0.05,delay:0.06}); break;   // breech slams shut
    case 'alarm':   tone(440,0.12,{type:'triangle',vol:0.12}); tone(330,0.17,{type:'triangle',vol:0.12,delay:0.13}); break;
    case 'beep':    tone(1200,0.05,{type:'triangle',vol:0.06}); break;
  }
  _bus=null;
}
export function __set_musicBus(v){ musicBus=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
export function __set_musicSrc(v){ musicSrc=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
export function __set_songBuf(v){ songBuf=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
export function __set_muted(v){ muted=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
