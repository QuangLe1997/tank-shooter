// audio/voice.js — Z161 RADIO VOICES: the commander (SCH) and the generals speak Vietnamese over the radio (ElevenLabs v3 lines, band-passed like a field set)
import { PROFILE, actx, audio, master, musicBus, muted } from '../hub.js';

// radio text → the recorded line that says it (first match wins); boss intros / taunts pass their key explicitly
export const VOICE_RULES = [
  [/Pháo kích|Rocket nhiệt áp/i, 'arty'], [/vòng ra sau lưng anh/i, 'flank'], [/anh bị thương/i, 'wounded'], [/trinh sát địch đang chỉ điểm/i, 'scout'],
  [/Xe chỉ huy địch đã bị hạ/i, 'cmd_down'], [/Chiến thắng!/i, 'victory'], [/trực thăng (vận tải|vũ trang)|trực thăng của chúng|Tiếng cánh quạt/i, 'heli'],
  [/khiên năng lượng bảo vệ/i, 'shield'], [/xe tăng đồng minh đã bị hạ/i, 'ally_down'], [/trại giam/i, 'pow'], [/THÁNH TÍCH CỔ/, 'relic'],
  [/Trại địch đã bị san phẳng/i, 'camp_down'], [/Tướng giữ .* đã bị hạ/i, 'fort_chief'], [/RPG/, 'rpg'], [/phục kích/i, 'ambush'], [/Không kích/i, 'air'],
  [/Giữ Lõi/i, 'hold'], [/Phát hiện địch phía trước/i, 'contact'], [/Đợt cuối|Đoàn xe cuối/i, 'last_wave'],
  [/Kho nhiên liệu cháy|Trạm tiếp sóng đã sập|Radar thành sắt vụn|Trận địa pháo đã câm|Hầm chỉ huy sập/i, 'obj_down'],
  [/Tổ bộ binh đang tới/i, 'infantry'], [/phun lửa/i, 'flame'],
];
export const VOICE = { bufs:{}, loading:{}, queue:[], playing:null, lastAt:{}, gain:0.95 };
export function voiceOn(){ return PROFILE.voice!==false && PROFILE.sound!==false && !muted; }
export function voiceKeyFor(msg){ for(const [re,k] of VOICE_RULES) if(re.test(msg)) return k; return null; }
function load(k){ if(VOICE.bufs[k] || VOICE.loading[k] || !actx) return VOICE.loading[k]||Promise.resolve(VOICE.bufs[k]);
  return (VOICE.loading[k]=fetch('assets/voice/'+k+'.mp3').then(r=>r.ok?r.arrayBuffer():Promise.reject(r.status)).then(b=>actx.decodeAudioData(b)).then(b=>(VOICE.bufs[k]=b)).catch(()=>null)); }
export function preloadVoices(keys){ if(!actx) return; for(const k of keys) load(k); }
// speak a line: one at a time, at most two waiting (older chatter is dropped), the same line never twice within 8 s; music ducks underneath
export function sayVoice(k){ if(!k || !voiceOn()) return; const a=audio(); if(!a || a.state!=='running') return; const now=performance.now()/1000;   // Z166 audio not unlocked yet → skip (a suspended context would jam the queue)
  if(now-(VOICE.lastAt[k]||-99) < 8) return; VOICE.lastAt[k]=now;
  VOICE.queue.push(k); while(VOICE.queue.length>2) VOICE.queue.shift(); if(!VOICE.playing) nextVoice(); }
function nextVoice(){ const k=VOICE.queue.shift(); if(!k){ VOICE.playing=null; duck(false); return; } VOICE.playing=k;
  load(k).then(buf=>{ if(!buf || !voiceOn()){ nextVoice(); return; } const s=actx.createBufferSource(), g=actx.createGain(); s.buffer=buf; g.gain.value=VOICE.gain; s.connect(g).connect(master);
    duck(true); s.onended=()=>setTimeout(nextVoice, 160); s.start(); }); }
function duck(on){ if(!musicBus || !actx || PROFILE.music===false) return; musicBus.gain.setTargetAtTime(on?0.22:0.5, actx.currentTime, on?0.08:0.4); }
// Z167 one-shot clips that don't wait in the radio queue (a scream, the victory cheer)
export function playClip(k, gain){ if(!k || PROFILE.sound===false || muted) return; const a=audio(); if(!a || a.state!=='running') return;
  load(k).then(buf=>{ if(!buf) return; const s=actx.createBufferSource(), g=actx.createGain(); s.buffer=buf; g.gain.value=gain??1; s.connect(g).connect(master); s.start(); }); }
