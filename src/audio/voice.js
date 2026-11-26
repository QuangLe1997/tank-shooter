// audio/voice.js — Z161 RADIO VOICES: the commander (SCH) and the generals speak Vietnamese over the radio · Z169 only danger calls and big moments are spoken, each line has 2–3 takes, danger cuts in over chatter
//   VOICE 1 the lines rewritten for a soldier on foot (no hulls, barrels or repair kits) + the soldier's danger calls (flank, sniper, machine gun, drone, grenade, resupply)
//   and the generals' voices · VOICE 2 every spoken line gets a subtitle; a radio line cuts the banter (audio/banter.js) and the music stays down while either talks
import { VOICE_CHAT } from '../../config.js';
import { PROFILE, VOICE_LINES, actx, audio, banterCut, banterStage, banterWin, master, musicBus, muted, voiceSub } from '../hub.js';

// radio text → the spoken line (first match wins); every other radio message stays text + a beep. Boss intros / taunts / rallies pass their key explicitly
export const VOICE_RULES = [
  [/Pháo kích|Rocket nhiệt áp/i, 'arty'], [/trực thăng (vận tải|vũ trang)|trực thăng của chúng|Tiếng cánh quạt/i, 'heli'], [/Không kích/i, 'air'], [/phục kích/i, 'ambush'],
  [/thả dù cứu thương|Thả dù đạn|Đạn đang xuống|thả dù tiếp tế/i, 'resupply'], [/anh bị thương/i, 'lowhp'], [/vòng sườn|vòng ra sau lưng|gọng kìm/i, 'flank'], [/bắn tỉa/i, 'sniper'],
  [/Đại liên địch/i, 'mg'], [/Drone trinh sát địch|con mắt trên trời|FPV cảm tử|Drone tự sát|Có FPV/i, 'drone'], [/Cận vệ đâu/i, 'gen_guard'], [/Ta chưa thua đâu/i, 'gen_rage'],
  [/Tướng giữ .* đã bị hạ/i, 'fort_chief'], [/Đợt cuối/i, 'last_wave'], [/Chiến thắng!/i, 'victory'],
];
// recorded takes per line (key_1.mp3 … key_n.mp3, never the same take twice running); a key not listed is one file, key.mp3
export const VOICE_TAKES = { open:3, arty:3, heli:2, air:2, ambush:2, lowhp:2, streak:3, last_wave:2, victory:2, flank:2, sniper:2, drone:2, nade:2, resupply:2 };
// [most times per battle, least seconds between two, urgent] — urgent = a danger call: cuts in over a calmer line, never waits in the queue
export const VOICE_LIMIT = { arty:[3,30,1], heli:[2,40,1], air:[2,40,1], ambush:[1,0,1], lowhp:[2,45,1], streak:[2,60,0],
  flank:[2,40,1], sniper:[2,60,1], mg:[1,0,1], drone:[2,45,1], nade:[3,15,1], resupply:[2,60,0], gen_meet:[1,0,0], gen_meet_xeom:[1,0,0], gen_guard:[1,0,0], gen_rage:[1,0,0] };
const PEAK=/^(f_rally_)|^(open|fort_chief|last_wave|victory|streak)$/;   // everything else is never spoken
const HYPE={ open:1, streak:1 };   // nice-to-have lines: only into silence, never queued
export const VOICE = { bufs:{}, loading:{}, queue:[], playing:null, src:null, seq:0, gapT:0, said:{}, lastAt:{}, lastTake:{}, endAt:-99, kills:[], gain:0.95, talk:null };   // talk: the banter line playing (audio/banter.js)
export function voiceOn(){ return PROFILE.voice!==false && PROFILE.sound!==false && !muted; }
export function voiceKeyFor(msg){ for(const [re,k] of VOICE_RULES) if(re.test(msg)) return k; return null; }
export function voiceSpoken(k){ return !!(VOICE_LIMIT[k] || PEAK.test(k||'')); }
export function voiceFiles(k){ const n=VOICE_TAKES[k]; return n ? Array.from({length:n}, (_,i)=>k+'_'+(i+1)) : [k]; }
export function voiceLoad(k){ return load(k); }
function load(k){ if(VOICE.bufs[k] || VOICE.loading[k] || !actx) return VOICE.loading[k]||Promise.resolve(VOICE.bufs[k]);
  return (VOICE.loading[k]=fetch('assets/voice/'+k+'.mp3').then(r=>r.ok?r.arrayBuffer():Promise.reject(r.status)).then(b=>actx.decodeAudioData(b)).then(b=>(VOICE.bufs[k]=b)).catch(()=>null)); }
export function preloadVoices(keys){ if(!actx) return; for(const k of keys) for(const f of voiceFiles(k)) load(f); }
function takeFor(k){ const n=VOICE_TAKES[k]; if(!n) return k; let i=1+Math.floor(Math.random()*n); if(n>1 && i===VOICE.lastTake[k]) i=i%n+1; VOICE.lastTake[k]=i; return k+'_'+i; }
// a new battle: every line is fresh again, the radio goes quiet
export function voiceStage(){ VOICE.said={}; VOICE.lastAt={}; VOICE.kills=[]; VOICE.queue.length=0; cutVoice(); duck(false); banterStage(); }
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
  VOICE.playing=k; const my=++VOICE.seq; banterCut();   // VOICE 2 the radio has the floor: the banter stops
  const f=takeFor(k); load(f).then(buf=>{ if(my!==VOICE.seq) return; if(!buf || !voiceOn()){ nextVoice(); return; }
    const s=actx.createBufferSource(), g=actx.createGain(); s.buffer=buf; g.gain.value=VOICE.gain; s.connect(g).connect(master); VOICE.src=s;
    const L=VOICE_LINES[f]; if(L) voiceSub(L[0], L[1], buf.duration);
    duck(true); s.onended=()=>{ if(k==='victory') banterWin(); if(my!==VOICE.seq) return; VOICE.src=null; VOICE.playing=null; VOICE.endAt=performance.now()/1000; VOICE.gapT=setTimeout(nextVoice, 450); }; s.start(); }); }
export function voiceDuck(on){ duck(on); }
function duck(on){ if(!musicBus || !actx || PROFILE.music===false || !on && (VOICE.playing || VOICE.talk)) return; musicBus.gain.setTargetAtTime(on?0.22:0.5, actx.currentTime, on?0.08:0.4); }   // (VOICE 2 down while anyone talks)
// VOICE 1 a run of kills (VOICE_CHAT.streak: n inside win s, a helicopter counts air) → the commander cheers (at most twice a battle)
export function voiceKill(e){ const now=performance.now()/1000, K=VOICE_CHAT.streak; VOICE.kills=VOICE.kills.filter(t=>now-t<K.win); for(let i=e && e.def && e.def.air ? K.air : 1; i>0; i--) VOICE.kills.push(now); if(VOICE.kills.length>=K.n && sayVoice('streak')) VOICE.kills=[]; }
// Z167 one-shot clips that don't wait in the radio queue (a scream, the victory cheer)
export function playClip(k, gain){ if(!k || PROFILE.sound===false || muted) return; const a=audio(); if(!a || a.state!=='running') return;
  load(k).then(buf=>{ if(!buf) return; const s=actx.createBufferSource(), g=actx.createGain(); s.buffer=buf; g.gain.value=gain??1; s.connect(g).connect(master); s.start(); }); }
