// audio/banter.js — VOICE 2 THE FUN TALK: the xe ôm driver, the soldier, his squad and the enemy SPEAK (the commander's radio stays in audio/voice.js).
//   · the driver's and the soldier's dialogue: the lines RIDE_TALK already shows (actors/driver*.js hand every one to RIDE_VOICE.play(who, event, index)) —
//     the driver close beside you on the seat, heard from where he stands when he is off it; the soldier's answer only when the line it answers was heard,
//     after it ends (VOICE_CHAT.hold s at most)
//   · what the game already does, looked at VOICE_CHAT.tick s apart (never per frame): a reload under fire (a mate covers), a mate's grenade, a hard hit, a dry
//     magazine, a silent blade kill, a body found / the alarm raised (the quiet counters), the call for the ride, getting on / off, a hard stop, a landing,
//     the night / the rain on a long ride, first contact on the bike
//   · the story's cues (campaign/story.js storyCue → banterCue): a kill, a mate down / patched up, a surrender, a squad breaking, a lull, a peak, the general
//     (his own voice), and the danger calls it hands to the radio (sniper, machine gun, grenade, flank)
//   RULES: one speaker at a time (a radio line cuts the banter; a higher group cuts a lower one, an equal or lower one is dropped), a gap per group, a budget of
//   chatter lines a minute (the driver's acts and the danger calls not counted), a line's takes cycled, the music ducked, a subtitle for every line.
//   PROFILE.banter === false (Cài đặt → Âm thanh → Thoại vui) = all of it off; the danger calls stay.
import * as THREE from 'three';
import { VOICE_CHAT as C } from '../../config.js';
import { CV, DIR, NADES, NIGHT, PROFILE, QUIET, RIDE_VOICE, S, VOICE, VOICE_LINES, WX, audio, camera, enemies, hudOn, master, sayVoice, squadList, voiceDuck, voiceLoad, voiceOn } from '../hub.js';

const NOW = () => performance.now() / 1000, GROUP = { c:'cmd', v:'foe', f:'foe', d:'drv', s:'sol', m:'mate', e:'foe' };
const _v = new THREE.Vector3(), _r = new THREE.Vector3();
export const BANTER = { cur:null, src:null, seq:0, gapN:{}, cyc:{}, log:[], last:null, wait:null, endAt:-9, rideAt:-9, poll:0, st:{}, stats:{ said:0, dropped:0, cut:0 } };
export function banterOn(){ return !!C.on && voiceOn() && PROFILE.banter !== false; }

// ---- the lines: 'd_drop' → d_drop_1 … d_drop_n (or the key itself), cycled — none again until all were said ----
const TAKES = {};
function takes(base){ if(TAKES[base]) return TAKES[base]; const out = []; if(VOICE_LINES[base]) out.push(base); for(let i = 1; VOICE_LINES[base + '_' + i]; i++) out.push(base + '_' + i); return (TAKES[base] = out); }
function used(base){ return BANTER.cyc[base] || (BANTER.cyc[base] = new Set()); }
function pick(base){ const T = takes(base); if(!T.length) return null; const U = used(base); if(U.size >= T.length) U.clear(); const free = T.filter(k => !U.has(k)); const k = free[(Math.random() * free.length) | 0]; U.add(k); return k; }
const R2 = a => a[0] + Math.random() * (a[1] - a[0]);
function later(s, fn){ setTimeout(() => { if(S.mode === 'playing') fn(); }, s * 1000); }
function drop(){ BANTER.stats.dropped++; return false; }

// ---- where a speaker stands: null = close (on the seat beside you, or the soldier himself) ----
function drvAt(){ const D = CV.H && CV.H.drv; if(!D || !D.w || CV.mounted && D.state === 'ride') return null; D.w.getWorldPosition(_v); return { x:_v.x, z:_v.z }; }
function foeNear(){ const p = S.player; if(!p) return null; let best = null, bd = C.pos.max * C.pos.max;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(!e.pos || e.hp <= 0 || e.def && e.def.air) continue; const d = (e.pos.x - p.pos.x) ** 2 + (e.pos.z - p.pos.z) ** 2; if(d < bd){ bd = d; best = e; } } return best && best.pos; }
function onBike(){ const H = CV.H; return !!(H && H.bike && H.drv && H.drv.ok); }
function mateUp(){ const L = squadList(); for(let i = 0; i < L.length; i++){ const r = L[i]; if(!r.dead && r.a && !r.a.dead) return true; } return false; }

// ---- say one line: true when it will be heard ----
function play(key, o){ o = o || {}; const L = key && VOICE_LINES[key]; if(!L || !banterOn()) return false; const a = audio(); if(!a || a.state !== 'running') return drop();
  const g = GROUP[L[0]] || 'foe', pr = C.prio[g], now = NOW(), p = S.player;
  if(VOICE.playing) return drop();                                                                                    // the radio has the floor
  if(BANTER.cur){ if(pr <= BANTER.cur.pr) return drop(); banterCut(); BANTER.stats.cut++; }                          // one speaker at a time
  const chat = !o.scene && !o.reply;
  if(chat){ if(now < (BANTER.gapN[g] || 0)) return drop(); BANTER.log = BANTER.log.filter(t => now - t < C.budget.win); if(BANTER.log.length >= C.budget.n) return drop(); }
  let gain = C.gain[g] ?? 0.9, pan = 0;
  if(o.at && p){ const dx = o.at.x - p.pos.x, dz = o.at.z - p.pos.z, d = Math.hypot(dx, dz); if(d > C.pos.max) return drop();
    gain *= d <= C.pos.ref ? 1 : Math.max(C.pos.min, C.pos.ref / d);
    if(d > 0.5){ _r.set(1, 0, 0).applyQuaternion(camera.quaternion); pan = Math.max(-0.8, Math.min(0.8, (dx * _r.x + dz * _r.z) / d)); } }
  const my = ++BANTER.seq; BANTER.cur = { key, pr, g, my }; if(chat) BANTER.log.push(now);
  voiceLoad(key).then(buf => { if(my !== BANTER.seq || !buf || VOICE.playing || NOW() - now > 0.9 || !banterOn()){ if(my === BANTER.seq) BANTER.cur = null; return; }
    const s = a.createBufferSource(), gn = a.createGain(); s.buffer = buf; gn.gain.value = gain; let out = gn;
    if(pan && a.createStereoPanner){ const P = a.createStereoPanner(); P.pan.value = pan; gn.connect(P); out = P; } s.connect(gn); out.connect(master);
    BANTER.src = s; VOICE.talk = key; BANTER.stats.said++; voiceDuck(true); voiceSub(L[0], L[1], buf.duration, !!o.float);
    s.onended = () => { try{ s.disconnect(); gn.disconnect(); out.disconnect(); }catch(e){} if(my !== BANTER.seq) return; BANTER.src = null; BANTER.cur = null; VOICE.talk = null;
      const t = NOW(); BANTER.endAt = t; BANTER.gapN[g] = t + R2(C.gap[g]); voiceDuck(false);
      const w = BANTER.wait; BANTER.wait = null; if(w && t < w.until) setTimeout(() => play(w.k, { reply:1, at:w.at, float:w.float }), 200); };
    s.start(); });
  return true; }
// a radio line starts (audio/voice.js nextVoice) or a battle ends: the banter stops at once
export function banterCut(){ BANTER.seq++; BANTER.wait = null; const s = BANTER.src; BANTER.src = null; BANTER.cur = null; VOICE.talk = null; if(s){ s.onended = null; try{ s.stop(); }catch(e){} } }
// an answer to the line playing now: it waits for it (hold s at most); nothing playing → said now
function answer(k, o){ if(!k) return; if(BANTER.cur) BANTER.wait = { k, until:NOW() + C.hold, at:o && o.at, float:o && o.float }; else play(k, Object.assign({ reply:1 }, o)); }

// ---- the ride's dialogue (actors/driver.js · driver-acts.js · driver-rant.js · driver-break.js through RIDE_VOICE.play) ----
function ride(who, ev, i){ const now = NOW(), float = hudOn('talk');
  if(who === 'driver'){ const base = 'd_' + ev; let k = base + '_' + ((i | 0) + 1); if(!VOICE_LINES[k]) return; const U = used(base);
    if(!float && ev !== 'argue' && U.has(k)){ if(U.size >= takes(base).length) U.clear(); else k = takes(base).find(x => !U.has(x)) || k; }   // (the text hidden: the takes cycle; shown, the voice says what is written)
    U.add(k); BANTER.rideAt = now; BANTER.last = { ev, at:now, ok:play(k, { scene:C.scene.includes(ev), at:drvAt(), float }) }; return; }
  const L = BANTER.last; if(!L || L.ev !== ev || !L.ok || now - L.at > 4) return;                                     // the soldier answers only what he heard
  answer('s_' + ev + '_' + ((i | 0) + 1), { float }); }

// ---- the story's cues (campaign/story.js storyCue, one line there) ----
export function banterCue(ev, data){ if(S.mode !== 'playing' || typeof ev !== 'string') return;
  if(ev === 'throw'){ play(pick('s_throw')); return; }                                                               // (combat/trooper-spells.js: his own grenade)
  if(ev === 'kill'){ if(Math.random() < C.kill.p) play(pick('s_kill')); return; }
  if(ev.startsWith('mate_down')){ play(pick('m_down')); return; }
  if(ev === 'mate_saved' || ev === 'patched'){ play(pick('m_saved')); return; }
  if(ev === 'surrender'){ play(pick('e_surr'), { at:foeNear() }); return; }
  if(ev === 'enemy_break'){ play(pick('e_break'), { at:foeNear() }); return; }
  if(ev === 'marksman'){ sayVoice('sniper'); return; }
  if(ev === 'mg'){ sayVoice('mg'); return; }
  if(ev === 'nade'){ sayVoice('nade'); return; }
  if(ev === 'dir_left' || ev === 'dir_right' || ev === 'dir_rear'){ sayVoice('flank'); return; }
  if(ev === 'dir_peak'){ if(mateUp()) play(pick('m_peak')); return; }
  if(ev === 'dir_lull'){ if(!BANTER.st.cq && Math.random() < 0.3){ BANTER.st.cq = 1; play('c_quiet'); } else if(mateUp()) play(pick('m_idle')); return; }
  if(ev === 'dir_hunt'){ if(onBike() && CV.mounted) play(pick('e_xeom'), { at:foeNear() }); return; }
  if(ev === 'general'){ sayVoice(onBike() && CV.mounted ? 'gen_meet_xeom' : 'gen_meet'); return; }
  if(ev === 'general_half'){ sayVoice('gen_guard'); return; }
  if(ev.startsWith('general_rage')) sayVoice('gen_rage'); }
// the victory call has ended (audio/voice.js): the driver waives the fare
export function banterWin(){ if(onBike()) later(0.8, () => play('d_win', { scene:1, at:drvAt() })); }

// ---- what the game is doing, VOICE_CHAT.tick s apart ----
function tick(){ const p = S.player; if(S.mode !== 'playing' || !p || !banterOn()) return; const now = NOW(), st = BANTER.st;
  const g = p.guns && p.guns[p.gunIdx], rel = !!(g && g.rU), dry = !!g && !p.infiniteAmmo && g.ammo <= 0;
  if(rel && !st.rel && DIR.near > 0 && play(pick('s_reload')) && mateUp()) answer(pick('m_cover'));                 // reloading under fire: a mate covers him
  st.rel = rel;
  if(dry && !st.dry) play(pick(Math.random() < C.ammoCmd ? 'c_ammo' : 's_dry')); st.dry = dry;
  for(let i = 0; i < NADES.length; i++){ const n = NADES[i]; if(!n._vb){ n._vb = 1; if(n.side === 'p' && !n.net) play(pick('m_throw'), { at:{ x:n.x0, z:n.z0 } }); } }
  if(st.hp != null && p.hp > p.maxHp * 0.3 && p.hp < st.hp - C.hurt.dmg) play(pick('s_hurt')); st.hp = p.hp;
  const Q = QUIET.stats || {};
  if((Q.knife | 0) > (st.knife ?? (Q.knife | 0))){ st.kn = now - (st.knAt || -99) < 30 ? (st.kn || 0) + 1 : 1; st.knAt = now; if(!(st.kn >= C.knifeCmd.n && Math.random() < C.knifeCmd.p && play('c_knife'))) play(pick('s_knife'), { scene:1 }); }
  if((Q.found | 0) > (st.found ?? (Q.found | 0))) play(pick('e_body'), { at:foeNear() });
  if((Q.raised | 0) > (st.raised ?? (Q.raised | 0))) play('e_alarm', { at:foeNear() });
  st.knife = Q.knife | 0; st.found = Q.found | 0; st.raised = Q.raised | 0;
  const H = CV.H, D = H && H.drv; if(!onBike()) return;
  if(CV.call && !st.call) play(pick('d_call'), { scene:1 }); st.call = !!CV.call;                                     // he answers the call on his phone
  const m = !!(CV.mounted && !CV.trans);
  if(m && st.m === false && D.state === 'ride' && now - BANTER.rideAt > 3){ if(play(pick('d_pickup'), { scene:1 })) answer(pick('s_pickup')); }
  if(!m && st.m && D.state === 'ride' && !H.onBreak && !H.broken && !CV.dead && p.hp > 0) play(pick('d_drop'), { scene:1 });
  st.m = m; if(!m){ st.rideT = 0; return; } st.rideT = (st.rideT || 0) + C.tick;
  const brk = !!(H.stop && H.stop.k > C.brake); if(brk && !st.brk) play(pick('d_brake')); st.brk = brk;
  const land = !!(H.air && H.air.landT > 0); if(land && !st.land) play(pick('d_bump')); st.land = land;
  if(st.rideT > C.ride){ if(!st.night && NIGHT.k > 0.5){ if(play('d_night')) st.night = 1; } else if(!st.rain && WX.id === 'rain'){ if(play('d_rain')) st.rain = 1; } }
  const near = DIR.near > 0; if(near && !st.near && now - (st.xeomAt ?? -1e9) > C.near.cd){ st.xeomAt = now; play(pick('e_xeom'), { at:foeNear() }); if(!st.cx){ st.cx = 1; later(4, () => play('c_xeom')); } } st.near = near;
  const dn = VOICE.said.drone | 0; if(dn > (st.drone | 0)) later(3.5, () => play('d_drone')); st.drone = dn; }

// a new battle (audio/voice.js voiceStage): a clean slate, the ride's voice hung on, the look-out started once
export function banterStage(){ banterCut(); Object.assign(BANTER, { gapN:{}, cyc:{}, log:[], last:null, wait:null, endAt:-9, rideAt:-9, st:{} }); BANTER.stats = { said:0, dropped:0, cut:0 };
  RIDE_VOICE.on = true; RIDE_VOICE.play = ride; if(!BANTER.poll && typeof setInterval === 'function') BANTER.poll = setInterval(tick, C.tick * 1000); }
// the settings switch turned on: one line to hear it
export function banterPreview(){ const was = BANTER.gapN.drv; BANTER.gapN.drv = 0; play(pick('d_pickup'), { scene:1 }); BANTER.gapN.drv = was; }

// ---- the subtitle: who + what, for every spoken line (a ride line whose text already floats over the speaker: not twice) ----
const SUB = { el:null, t:0 };
export function voiceSub(who, text, dur, floated){ if(floated || typeof document === 'undefined') return; let el = SUB.el;
  if(!el){ el = SUB.el = document.createElement('div'); el.id = 'voiceSub';
    el.style.cssText = 'position:fixed;left:50%;bottom:17%;transform:translateX(-50%);max-width:min(84vw,560px);padding:3px 10px;border-radius:6px;background:rgba(0,0,0,.5);color:#f4f4f0;font:600 13px/1.35 system-ui,sans-serif;text-align:center;pointer-events:none;z-index:40;opacity:0;transition:opacity .2s';
    document.body.appendChild(el); }
  const W = C.sub.who[who] || ['', '#fff'], b = document.createElement('b'); b.style.color = W[1]; b.textContent = W[0] + ': '; el.textContent = ''; el.appendChild(b); el.appendChild(document.createTextNode(text));
  el.style.opacity = '1'; clearTimeout(SUB.t); SUB.t = setTimeout(() => { el.style.opacity = '0'; }, ((dur || 2) + C.sub.t) * 1000); }
