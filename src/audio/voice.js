// audio/voice.js — Z161 RADIO VOICES: the commander (SCH) and the generals speak Vietnamese over the radio · Z169 only danger calls and big moments are spoken, each line has 2–3 takes, danger cuts in over chatter
import { PROFILE, actx, audio, master, musicBus, muted } from '../hub.js';

// radio text → the spoken line (first match wins); every other radio message stays text + a beep. Boss intros / taunts / rallies pass their key explicitly
export const VOICE_RULES = [
  [/Pháo kích|Rocket nhiệt áp/i, 'arty'], [/trực thăng (vận tải|vũ trang)|trực thăng của chúng|Tiếng cánh quạt/i, 'heli'], [/Không kích/i, 'air'], [/phục kích/i, 'ambush'],
  [/anh bị thương/i, 'lowhp'], [/Xe chỉ huy địch đã bị hạ/i, 'cmd_down'], [/Tướng giữ .* đã bị hạ/i, 'fort_chief'], [/Đợt cuối|Đoàn xe cuối/i, 'last_wave'], [/Chiến thắng!/i, 'victory'],
];
// recorded takes per line (key_1.mp3 … key_n.mp3, never the same take twice running); a key not listed is one file, key.mp3
export const VOICE_TAKES = { open:3, arty:3, heli:2, air:2, ambush:2, lowhp:2, streak:3, last_wave:2, victory:2, boss_phase:2 };
// [most times per battle, least seconds between two, urgent] — urgent = a danger call: cuts in over a calmer line, never waits in the queue
export const VOICE_LIMIT = { arty:[3,30,1], heli:[2,40,1], air:[2,40,1], ambush:[1,0,1], lowhp:[2,45,1], streak:[2,60,0], boss_phase:[2,20,0] };
const PEAK=/^(boss_|t_|f_rally_)|^(open|cmd_down|fort_chief|last_wave|victory|boss_phase|streak)$/;   // everything else is never spoken
const HYPE={ open:1, streak:1 };   // nice-to-have lines: only into silence, never queued
export const VOICE = { bufs:{}, loading:{}, queue:[], playing:null, src:null, seq:0, gapT:0, said:{}, lastAt:{}, lastTake:{}, endAt:-99, kills:[], gain:0.95 };
export function voiceOn(){ return PROFILE.voice!==false && PROFILE.sound!==false && !muted; }
export function voiceKeyFor(msg){ for(const [re,k] of VOICE_RULES) if(re.test(msg)) return k; return null; }
export function voiceSpoken(k){ return !!(VOICE_LIMIT[k] || PEAK.test(k||'')); }
export function voiceFiles(k){ const n=VOICE_TAKES[k]; return n ? Array.from({length:n}, (_,i)=>k+'_'+(i+1)) : [k]; }
function load(k){ if(VOICE.bufs[k] || VOICE.loading[k] || !actx) return VOICE.loading[k]||Promise.resolve(VOICE.bufs[k]);
  return (VOICE.loading[k]=fetch('assets/voice/'+k+'.mp3').then(r=>r.ok?r.arrayBuffer():Promise.reject(r.status)).then(b=>actx.decodeAudioData(b)).then(b=>(VOICE.bufs[k]=b)).catch(()=>null)); }
export function preloadVoices(keys){ if(!actx) return; for(const k of keys) for(const f of voiceFiles(k)) load(f); }
function takeFor(k){ const n=VOICE_TAKES[k]; if(!n) return k; let i=1+Math.floor(Math.random()*n); if(n>1 && i===VOICE.lastTake[k]) i=i%n+1; VOICE.lastTake[k]=i; return k+'_'+i; }
// a new battle: every line is fresh again, the radio goes quiet
export function voiceStage(){ VOICE.said={}; VOICE.lastAt={}; VOICE.kills=[]; VOICE.queue.length=0; cutVoice(); duck(false); }
function cutVoice(){ VOICE.seq++; clearTimeout(VOICE.gapT); VOICE.gapT=0; if(VOICE.src){ VOICE.src.onended=null; try{ VOICE.src.stop(); }catch(e){} } VOICE.src=null; VOICE.playing=null; }
// speak a line if it earns it; returns true when it will be heard (radio() beeps otherwise). force = the settings preview
export function sayVoice(k, force){ if(!k || !voiceOn()) return false; const a=audio(); if(!a || a.state!=='running') return false; const now=performance.now()/1000;   // Z166 audio not unlocked yet → skip (a suspended context would jam the queue)
  const L=VOICE_LIMIT[k]; if(!force){ if(!voiceSpoken(k)) return false;
    if((VOICE.said[k]|0) >= (L?L[0]:1) || now-(VOICE.lastAt[k]??-1e9) < (L?L[1]:0)) return false;
    if(HYPE[k] && (VOICE.playing || VOICE.gapT || VOICE.queue.length || now-VOICE.endAt<4)) return false; }
  const urgent=!force && L && L[2];
  if(urgent && VOICE.playing && VOICE_LIMIT[VOICE.playing]?.[2]) return false;   // one danger call at a time
  VOICE.said[k]=(VOICE.said[k]|0)+1; VOICE.lastAt[k]=now;
  if(urgent || force){ cutVoice(); VOICE.queue.unshift(k); nextVoice(); return true; }
  VOICE.queue.push(k); while(VOICE.queue.length>2) VOICE.queue.shift();
  if(!VOICE.playing && !VOICE.gapT) nextVoice(); return true; }
function nextVoice(){ clearTimeout(VOICE.gapT); VOICE.gapT=0; const k=VOICE.queue.shift(); if(!k){ VOICE.playing=null; duck(false); return; }
  VOICE.playing=k; const my=++VOICE.seq;
  load(takeFor(k)).then(buf=>{ if(my!==VOICE.seq) return; if(!buf || !voiceOn()){ nextVoice(); return; }
    const s=actx.createBufferSource(), g=actx.createGain(); s.buffer=buf; g.gain.value=VOICE.gain; s.connect(g).connect(master); VOICE.src=s;
    duck(true); s.onended=()=>{ if(my!==VOICE.seq) return; VOICE.src=null; VOICE.playing=null; VOICE.endAt=performance.now()/1000; VOICE.gapT=setTimeout(nextVoice, 450); }; s.start(); }); }
function duck(on){ if(!musicBus || !actx || PROFILE.music===false) return; musicBus.gain.setTargetAtTime(on?0.22:0.5, actx.currentTime, on?0.08:0.4); }
// three vehicles down inside 7 s → the commander cheers (at most twice a battle)
export function voiceKill(){ const now=performance.now()/1000; VOICE.kills=VOICE.kills.filter(t=>now-t<7); VOICE.kills.push(now); if(VOICE.kills.length>=3 && sayVoice('streak')) VOICE.kills=[]; }
// Z167 one-shot clips that don't wait in the radio queue (a scream, the victory cheer)
export function playClip(k, gain){ if(!k || PROFILE.sound===false || muted) return; const a=audio(); if(!a || a.state!=='running') return;
  load(k).then(buf=>{ if(!buf) return; const s=actx.createBufferSource(), g=actx.createGain(); s.buffer=buf; g.gain.value=gain??1; s.connect(g).connect(master); s.start(); }); }
