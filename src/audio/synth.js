// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import * as THREE from 'three';
import { S, VIEW, worldToScreen } from '../hub.js';

// ----------------------------- AUDIO (Web Audio synth) -----------------------------
export let actx=null, master=null, musicBus=null, musicSrc=null, songBuf=null, muted=false;
// ---- AUDIO ENGINE: compressor master + outdoor convolution reverb send, shared noise buffers, positional voices ----
export let comp=null, verb=null, verbSend=null, NZ=null, BNZ=null, shaper=null, _bus=null;
export function audio(){
  if(!actx){ try{ actx=new (window.AudioContext||window.webkitAudioContext)();
    master=actx.createGain(); master.gain.value=muted?0:0.5;
    comp=actx.createDynamicsCompressor(); comp.threshold.value=-16; comp.knee.value=12; comp.ratio.value=4; comp.attack.value=0.003; comp.release.value=0.22;
    master.connect(comp).connect(actx.destination);
    const sr=actx.sampleRate;
    NZ=actx.createBuffer(1, sr*2, sr); { const d=NZ.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }                       // white
    BNZ=actx.createBuffer(1, sr*2, sr); { const d=BNZ.getChannelData(0); let l=0; for(let i=0;i<d.length;i++){ l=(l+0.02*(Math.random()*2-1))/1.02; d[i]=l*3.5; } }   // brown (rumble)
    const L=Math.floor(sr*2.2), ir=actx.createBuffer(2, L, sr);                                                                          // outdoor IR: sparse early slap-back + soft diffuse tail
    for(let c=0;c<2;c++){ const d=ir.getChannelData(c); let lp=0; for(let i=0;i<L;i++){ const t=i/sr; lp+= ((Math.random()*2-1) - lp)*0.18; d[i]=lp*Math.pow(1-t/2.2,3.2)*0.9; }
      for(const [t,a] of [[0.045,0.5],[0.11,0.35],[0.19,0.22],[0.31,0.14]]){ const k=Math.floor((t+c*0.007)*sr); d[k]+=a; } }
    verb=actx.createConvolver(); verb.buffer=ir; verbSend=actx.createGain(); verbSend.gain.value=0.32; verbSend.connect(verb).connect(master);
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
  out.connect(master); if(verbSend){ const s=a.createGain(); s.gain.value=wet==null?0.3:wet; out.connect(s).connect(verbSend); }
  return g;
}
export function tone(freq, dur, {type='sine', vol=0.2, delay=0, slideTo=null, bus=null}={}){
  const a=audio(); if(!a) return;
  const t0=a.currentTime+delay; const o=a.createOscillator(), g=a.createGain();
  o.type=type; o.frequency.setValueAtTime(freq,t0);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1,slideTo), t0+dur);
  g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(vol,t0+0.006);
  g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  o.connect(g).connect(bus||_bus||master||a.destination); o.start(t0); o.stop(t0+dur+0.03);
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
  node.connect(g).connect(bus||_bus||master||a.destination); src.start(t0, Math.random()*1.5); src.stop(t0+dur+0.05);
}
// layered gunshot: supersonic CRACK + muzzle-blast BODY (saturated) + SUB thump + optional mechanism click
export function gunshot(o, bus){
  const c=o.crack||0, b=o.body||0.2, len=o.len||0.12;
  if(c) noise(0.012+len*0.04, {vol:c, type:'hp', hp:2600, bus, attack:0.001});
  noise(len, {vol:b, type:'lp', lp:o.lp||2200, sweepTo:(o.lp||2200)*0.35, bus, attack:0.002, dist:true});
  if(o.sub) tone(o.subF||90, len*1.8, {type:'sine', vol:o.sub, slideTo:(o.subF||90)*0.42, bus});
  if(o.click) tone(o.click, 0.03, {type:'square', vol:0.05, slideTo:o.click*0.6, bus, delay:o.clickDelay||0.04});
  if(o.ring) tone(o.ring, 0.25, {type:'triangle', vol:0.05, slideTo:o.ring*0.9, bus, delay:0.01});
}
export function explosionSnd(big, bus){
  const k=big?1:0.65;
  tone(big?58:72, big?1.3:0.8, {type:'sine', vol:0.42*k, slideTo:20, bus});                                     // sub-bass shock
  noise(big?1.4:0.9, {vol:0.5*k, type:'lp', lp:1200, sweepTo:160, bus, brown:true, attack:0.003, dist:true});   // rolling rumble
  noise(0.22, {vol:0.35*k, type:'lp', lp:4200, sweepTo:600, bus, attack:0.001, dist:true});                     // the blast crack
  for(let i=0;i<(big?14:8);i++) noise(0.02+Math.random()*0.03, {vol:(0.05+Math.random()*0.08)*k, type:'hp', hp:2500+Math.random()*3000, delay:0.05+Math.random()*0.6, bus});   // crackle + debris rain
  for(let i=0;i<(big?5:3);i++) tone(500+Math.random()*900, 0.06, {type:'triangle', vol:0.03*k, slideTo:300, delay:0.25+Math.random()*0.7, bus});   // metal fragments landing
}
export function sfx(name, pos){
  if(muted) return;
  const UI = name==='click'||name==='beep'||name==='wave'||name==='powerup'||name==='levelup'||name==='alarm';
  const bus = UI ? null : voice(pos||null, pos?0.3:0.22); _bus = bus;
  switch(name){
    case 'shoot':
    case 'shoot_rifle':  gunshot({crack:0.16, body:0.28, lp:2600, len:0.11, sub:0.14, subF:120, click:900}); break;            // 30 mm autocannon
    case 'shoot_smg':    gunshot({crack:0.12, body:0.18, lp:3200, len:0.06, sub:0.06, subF:150}); break;                       // twin 14.5 mm MG
    case 'shoot_minigun':gunshot({crack:0.09, body:0.13, lp:3600, len:0.045, sub:0.04, subF:170}); break;                      // rotary — a ripping buzz at rate
    case 'shoot_shotgun':gunshot({crack:0.12, body:0.42, lp:1500, len:0.2, sub:0.26, subF:80}); noise(0.08,{vol:0.1,type:'hp',hp:3000,delay:0.02}); break;   // canister + pellet hiss
    case 'shoot_agl':    gunshot({crack:0.06, body:0.34, lp:900, len:0.14, sub:0.26, subF:85}); break;                        // 40 mm grenade — hollow thoomp
    case 'shoot_thermo': noise(0.6,{vol:0.26,type:'lp',lp:1800,sweepTo:600,attack:0.02,dist:true}); gunshot({crack:0.1, body:0.4, lp:1100, len:0.2, sub:0.32, subF:60}); break;   // rocket motor roar
    case 'shoot_flak':   gunshot({crack:0.15, body:0.3, lp:2200, len:0.13, sub:0.16, subF:110, click:700}); break;
    case 'shoot_hesh':   gunshot({crack:0.2, body:0.5, lp:1300, len:0.32, sub:0.38, subF:70, ring:220}); break;               // 105 mm
    case 'shoot_cannon': gunshot({crack:0.24, body:0.55, lp:1200, len:0.38, sub:0.45, subF:62, ring:180}); break;             // 120 mm — the big boom + barrel ring
    case 'shoot_missile':noise(0.5,{vol:0.22,type:'lp',lp:2600,sweepTo:900,attack:0.02,dist:true}); tone(220,0.35,{type:'sawtooth',vol:0.06,slideTo:420}); noise(0.06,{vol:0.1,type:'hp',hp:2000}); break;   // ATGM motor whoosh
    case 'shoot_railgun':tone(2400,0.18,{type:'sawtooth',vol:0.08,slideTo:300}); noise(0.05,{vol:0.3,type:'hp',hp:3500,attack:0.001}); tone(90,0.3,{type:'sine',vol:0.3,slideTo:35}); noise(0.25,{vol:0.12,type:'bp',hp:300,lp:1500,delay:0.02}); break;   // capacitor snap + slug crack
    case 'shoot_cryo':   noise(0.16,{vol:0.18,type:'hp',hp:2500,sweepTo:6000}); tone(900,0.12,{type:'sine',vol:0.05,slideTo:1600}); break;
    case 'shoot_tesla':  noise(0.12,{vol:0.2,type:'bp',hp:1500,lp:6000,dist:true}); tone(120,0.15,{type:'sawtooth',vol:0.08,slideTo:60}); break;
    case 'hit':     noise(0.05,{vol:0.12,type:'bp',hp:1800,lp:5200,bus}); tone(640,0.09,{type:'triangle',vol:0.05,slideTo:420,bus}); break;   // round slapping armour
    case 'enemyShoot': gunshot({crack:0.1, body:0.24, lp:1700, len:0.15, sub:0.14, subF:95}, bus); break;
    case 'explode':    explosionSnd(false, bus); break;
    case 'bigexplode': explosionSnd(true, bus); break;
    case 'hurt':    noise(0.18,{vol:0.3,type:'lp',lp:1400,dist:true}); tone(150,0.22,{type:'square',vol:0.1,slideTo:70}); tone(820,0.18,{type:'triangle',vol:0.06,slideTo:500,delay:0.02}); break;   // hull hit: thump + clang
    case 'corehit': tone(150,0.14,{type:'sawtooth',vol:0.16,slideTo:70}); break;
    case 'wave':    [523,659,784].forEach((f,i)=>tone(f,0.2,{type:'triangle',vol:0.14,delay:i*0.07})); break;
    case 'dash':    noise(0.3,{vol:0.2,type:'lp',lp:900,sweepTo:2400,brown:true}); tone(60,0.3,{type:'sawtooth',vol:0.08,slideTo:110}); break;   // engine surge
    case 'powerup': [659,988,1319].forEach((f,i)=>tone(f,0.18,{type:'triangle',vol:0.14,delay:i*0.05})); break;
    case 'levelup': [523,659,784,1047,1319].forEach((f,i)=>tone(f,0.24,{type:'triangle',vol:0.15,delay:i*0.08})); break;
    case 'spell':   tone(440,0.25,{type:'sine',vol:0.14,slideTo:1320}); break;
    case 'click':   tone(660,0.07,{type:'square',vol:0.12}); break;
    case 'reload':  noise(0.05,{vol:0.12,type:'bp',hp:1200,lp:4000}); tone(180,0.06,{type:'square',vol:0.08,delay:0.02}); noise(0.06,{vol:0.14,type:'bp',hp:900,lp:3000,delay:0.16}); tone(120,0.07,{type:'square',vol:0.08,delay:0.17}); break;   // breech open … round seated
    case 'reloaded':noise(0.04,{vol:0.16,type:'bp',hp:1500,lp:5000}); tone(260,0.08,{type:'square',vol:0.08,slideTo:180}); tone(1320,0.1,{type:'triangle',vol:0.06,delay:0.06}); break;   // breech slams shut
    case 'alarm':   tone(440,0.12,{type:'square',vol:0.11}); tone(330,0.17,{type:'square',vol:0.11,delay:0.13}); break;
    case 'rocketlaunch': noise(0.7,{vol:0.32,type:'lp',lp:2200,sweepTo:500,attack:0.01,dist:true,brown:true}); noise(0.15,{vol:0.2,type:'hp',hp:1800}); tone(70,0.5,{type:'sine',vol:0.3,slideTo:30}); break;
    case 'beep':    tone(1500,0.05,{type:'square',vol:0.07}); break;
    case 'crunch':  noise(0.1,{vol:0.12,type:'bp',hp:600,lp:3200,bus}); noise(0.05,{vol:0.08,type:'hp',hp:2500,delay:0.03,bus}); break;      // stones grinding under the tracks
    case 'clang':   tone(190,0.3,{type:'triangle',vol:0.18,slideTo:120,bus}); tone(470,0.2,{type:'square',vol:0.05,slideTo:330,bus}); noise(0.16,{vol:0.2,type:'bp',hp:500,lp:4000,bus}); break;   // hull-on-hull impact
    case 'thud':    tone(70,0.22,{type:'sine',vol:0.24,slideTo:38,bus}); noise(0.14,{vol:0.16,type:'lp',lp:900,brown:true,bus}); break;
  }
  _bus=null;
}
export function __set_musicBus(v){ musicBus=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
export function __set_musicSrc(v){ musicSrc=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
export function __set_songBuf(v){ songBuf=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
export function __set_muted(v){ muted=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
