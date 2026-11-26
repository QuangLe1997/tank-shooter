// net/coop.js — COOP 2 THE CO-OP SESSION: idle → connecting → lobby → ready → playing → ended, who is host, the seed and battle agreed in the lobby, snapshots out / inputs in at their rates, events that must arrive, and the hooks the game calls (coopActive, coopIsHost, coopBroadcast, coopSendInput, coopOnSnapshot …) — it does NOTHING until coopStart() finds ?room= in the address; no three, no DOM, no hub (runs in Node)
import { COOP } from '../../config.js';
import { NET_MSG, makeNetFrame, makeNetInput, netFrameReset, netPlayerQ, netPlayerObj, netMsgKind, packInput, unpackInput, packPing, unpackPing, packControl, parseControl, netCleanSettings, netSeqNewer, netRand, createSnapEncoder, createSnapDecoder, createEventOutbox, createEventInbox } from './protocol.js';
import { createSnapInterp } from './interp.js';
import { createWsTransport } from './transport.js';

// ?room=CODE (& coop=host for the one who runs the battle; & seed=N the battlefield both pages build — boot/safety.js reads the same parameter; & name=…)
//   → { room, host, seed, name }, or null when the address asks for no room
export function coopParseUrl(search){ const q = new URLSearchParams(String(search || '').replace(/^[^?]*\?/, '')), room = String(q.get('room') || '').toUpperCase(); if(!/^[A-Z0-9]{3,12}$/.test(room)) return null;
  return { room, host:q.get('coop') === 'host', seed:/^\d{1,10}$/.test(q.get('seed') || '') ? (+q.get('seed') >>> 0) : 0, name:String(q.get('name') || '').slice(0, COOP.limits.name) }; }
// the room's WebSocket on the server the page came from (tools/lan-room.mjs)
export function coopWsUrl(loc, room, role, name){ return (loc && loc.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + (loc ? loc.host : 'localhost') + '/ws?room=' + encodeURIComponent(room) + '&role=' + role + '&name=' + encodeURIComponent(name || ''); }
// true once every 1000 / hz ms of the clock it is asked with (the game loop asks each frame)
function makeRate(hz){ const iv = 1000 / hz; let next = -1; return t => { if(next >= 0 && t < next) return false; next = next < 0 || t - next > iv * 4 ? t + iv : next + iv; return true; }; }

// One side of a co-op game. o: { role:'host'|'guest', room, name, transport (net/transport.js interface), now() → ms, timers (false = the caller steps it) }
//   the HOST: setSettings({ seed, battle }) → both setReady(true) → state 'ready' → begin() → 'playing': each snapshot  f = frame(); netFrameAdd(f, …) / netFramePlayer(f, …); broadcast(f)
//   the GUEST: setReady(true) → 'playing' when the host begins: sendInput(state) at inputDue(), on('snapshot'), sample(now) each frame for the drawn world
//   both: sendEvent(type, a, b, x, y, z, p) (arrives once, in order) · on('event', fn(type, a, b, x, y, z, p)) · on('state', fn(state, before, reason))
export function createCoopSession(o){ const now = o.now || (() => performance.now()), tr = o.transport, K = COOP.session, host = o.role === 'host';
  const L = { state:[], snapshot:[], input:[], event:[], settings:[], peer:[], error:[] };
  const emit = (k, a, b, c, d, e, f, g) => { const l = L[k]; for(let i = 0; i < l.length; i++){ try{ l[i](a, b, c, d, e, f, g); }catch(err){ console.error('coop: a ' + k + ' handler threw', err); } } };
  const enc = host ? createSnapEncoder() : null, dec = host ? null : createSnapDecoder(), outbox = createEventOutbox(), inbox = createEventInbox();
  const interp = createSnapInterp(host ? { delayMs:COOP.interp.inputDelayMs } : null);   // the guest: the world · the host: the guest's soldier
  const out = makeNetFrame(), inp = makeNetInput(), rin = makeNetInput(), pin = makeNetFrame(), pobj = {};
  const snapDue = makeRate(COOP.snapHz), inputDue = makeRate(COOP.inputHz), onEv = (t, a, b, x, y, z, p) => emit('event', t, a, b, x, y, z, p);
  let timer = null, helloAt = 0, pingAt = 0, pingSent = 0, peerHello = false, peerLostAt = 0, wired = false;
  const C = { role:host ? 'host' : 'guest', room:o.room || '', name:String(o.name || '').slice(0, COOP.limits.name), sid:o.sid || (netRand().toString(36) + netRand().toString(36)).replace(/0\./g, '').slice(0, 12), state:'idle', reason:'',
    peer:false, peerName:'', peerSid:'', ready:false, peerReady:false, seed:0, battle:{}, rev:0, rtt:0, pongs:0, tick:0, inSeq:0, hasIn:false, peerAck:0, transport:tr, interp, encoder:enc, decoder:dec, outbox, inbox,
    stats:{ snapsOut:0, snapsIn:0, inputsOut:0, inputsIn:0, bytesOut:0, bytesIn:0, errors:0, lastError:'' },
    on(kind, fn){ if(!L[kind]) throw new RangeError('coop: no "' + kind + '" to listen to'); L[kind].push(fn); return C; },
    get isHost(){ return host; }, get peerLost(){ return peerLostAt > 0; },
    start(){ if(C.state !== 'idle') return C; setState('connecting');
      if(!wired){ wired = true; tr.onNotice(onNotice); tr.onMessage(onMessage); tr.onClose(onClose); }
      if(o.timers !== false) timer = setInterval(() => C.step(now()), K.tickMs); tr.open(); return C; },
    stop(reason){ finish(reason || 'left', false); },
    // housekeeping (the timer calls it; with timers:false the caller does): say hello again to a silent peer, time the round trip, give up on a lost peer
    step(t){ if(C.state === 'idle' || C.state === 'ended') return;
      if(C.peer && !peerHello && t - helloAt > K.helloMs) hello(true);
      if(C.state === 'playing' && peerLostAt && t - peerLostAt > K.peerLostMs) return finish('peer-lost', false);
      if(C.peer && tr.state === 'open' && t - pingAt >= K.pingMs){ pingAt = t; pingSent = now(); tr.send(packPing(NET_MSG.PING, pingSent), true); } },
    // ----- the lobby -----
    setSettings(s){ if(!host || C.state === 'playing' || C.state === 'ended') return false; const c = netCleanSettings(s); if(!c.seed) return false;
      C.seed = c.seed; C.battle = c.battle; C.rev++; C.peerReady = false; ctl('settings', { seed:C.seed, battle:C.battle, rev:C.rev }); emit('settings', C.seed, C.battle); evaluate(); return true; },
    setReady(on){ if(C.state !== 'lobby' && C.state !== 'ready' && C.state !== 'connecting') return false; C.ready = !!on; sendReady(); evaluate(); return true; },
    begin(){ if(!host || C.state !== 'ready') return false; ctl('start', { seed:C.seed, battle:C.battle, rev:C.rev }); play(false); return true; },
    // ----- the battle -----
    frame(){ return netFrameReset(out, 0, 0); },   // the host's outgoing snapshot, emptied: fill it, then broadcast() it
    broadcast(f){ if(!host || C.state !== 'playing' || !C.peer || !peerHello) return 0; f = f || out; C.tick++; f.tick = C.tick; f.back = 0; f.time = now() >>> 0; f.ackInput = C.inSeq; f.ackEv = inbox.last; outbox.fill(f);
      const bytes = enc.encode(f, C.peerAck); tr.send(bytes, true); C.stats.snapsOut++; C.stats.bytesOut += bytes.length; return bytes.length; },
    sendInput(st){ if(host || C.state !== 'playing' || !C.peer) return 0; inp.seq = (inp.seq + 1) & 0xffff; inp.ackTick = dec.ackTick(); inp.time = now() >>> 0; inp.ackEv = inbox.last; netPlayerQ(inp.pl, 0, st); if(!inp.pl[0]) inp.pl[0] = COOP.ids.guest; outbox.fill(inp);
      const bytes = packInput(inp); tr.send(bytes, true); C.stats.inputsOut++; C.stats.bytesOut += bytes.length; return bytes.length; },
    sendEvent(type, a, b, x, y, z, p){ if(C.state !== 'playing') return 0; return outbox.push(type, a | 0, b | 0, x || 0, y || 0, z || 0, p | 0); },
    sample(t, into){ return interp.sample(t == null ? now() : t, into); },
    snapDue, inputDue };

  function setState(s, reason){ if(C.state === s) return; const was = C.state; C.state = s; C.reason = reason || ''; emit('state', s, was, C.reason); }
  function ctl(kind, body){ tr.send(packControl(kind, body), false); }
  function hello(want){ helloAt = now(); ctl('hello', { sid:C.sid, name:C.name, role:C.role, want:!!want }); }   // want = "I have not heard yours": the peer says it again
  function sendReady(){ ctl('ready', { on:C.ready, rev:C.rev }); }
  function evaluate(){ const ok = C.peer && peerHello && C.ready && C.peerReady && C.seed > 0; if(C.state === 'lobby' && ok) setState('ready'); else if(C.state === 'ready' && !ok) setState('lobby'); }
  // the peer is a new page (or a new battle starts): nothing either side remembers of the other holds any more
  function resetLink(){ if(enc) enc.reset(); if(dec) dec.reset(); interp.reset(); outbox.reset(); inbox.reset(); C.hasIn = false; C.inSeq = 0; C.peerAck = 0; inp.seq = 0; }
  function play(resume){ if(!resume) resetLink(); peerLostAt = 0; setState('playing', resume ? 'resume' : ''); }
  function finish(reason, fromPeer){ if(C.state === 'ended') return; if(!fromPeer && C.state !== 'idle' && tr.state === 'open') ctl('end', { reason }); clearInterval(timer); timer = null; setState('ended', reason); tr.close(); }
  function peerGone(){ const had = C.peer; C.peer = false; peerHello = false; C.peerReady = false; if(C.state === 'ready') setState('lobby', 'peer-left'); if(C.state === 'playing' && !peerLostAt) peerLostAt = now(); if(had) emit('peer', false, C.peerName); }
  function onNotice(n){ if(C.state === 'ended' || !n) return;
    if(n.sys === 'joined'){ if(C.state === 'connecting') setState('lobby'); if(n.peer){ C.peer = true; C.peerName = String(n.peerName || '').slice(0, COOP.limits.name); hello(); } else peerGone(); }
    else if(n.sys === 'peer-join'){ C.peer = true; C.peerName = String(n.name || '').slice(0, COOP.limits.name); hello(); }
    else if(n.sys === 'peer-leave') peerGone();
    else if(n.sys === 'error') finish(String(n.code || 'refused'), true); }
  function onClose(info){ if(C.state === 'ended' || C.state === 'idle') return; if(info && info.retry){ peerGone(); return; }   // the line is coming back by itself: wait for it
    finish(info && info.fatal ? 'refused' : 'link-lost', true); }
  function onMessage(d, bin){ if(C.state === 'ended') return; C.stats.bytesIn += typeof d === 'string' ? d.length : d.byteLength;
    try{ if(bin) onBin(d); else onCtl(parseControl(d)); }
    catch(e){ C.stats.errors++; C.stats.lastError = String(e && e.message || e); emit('error', e); if(e && e.code === 'VERSION') finish('version', false); } }   // a bad message is counted and dropped, never thrown into the game loop
  function onCtl(m){
    if(m.k === 'hello'){ if(m.role === C.role) return finish('same-role', false); const sid = String(m.sid || '').slice(0, 16), fresh = sid !== C.peerSid, known = !!C.peerSid; C.peerSid = sid; C.peer = true; peerHello = true; if(m.name) C.peerName = String(m.name).slice(0, COOP.limits.name);
      if(m.want) hello(false);
      if(fresh && known && !host && C.state === 'playing') return finish('host-restarted', false);   // the battle lived on the host's page: a new page there has none
      if(fresh){ resetLink(); C.peerReady = false; } if(C.state === 'playing') peerLostAt = 0;
      if(host){ if(C.seed) ctl('settings', { seed:C.seed, battle:C.battle, rev:C.rev }); if(C.state === 'playing') ctl('start', { seed:C.seed, battle:C.battle, rev:C.rev, resume:true }); }
      sendReady(); emit('peer', true, C.peerName); evaluate(); }
    else if(m.k === 'settings'){ if(host || C.state === 'playing') return; const c = netCleanSettings(m); if(!c.seed) return; const changed = (m.rev | 0) !== C.rev; C.seed = c.seed; C.battle = c.battle; C.rev = m.rev | 0;
      if(changed && C.ready){ C.ready = false; } emit('settings', C.seed, C.battle); sendReady(); evaluate(); }
    else if(m.k === 'ready'){ C.peerReady = !!m.on && (m.rev | 0) === C.rev; evaluate(); }
    else if(m.k === 'start'){ if(host) return; const c = netCleanSettings(m); if(!c.seed) return; C.seed = c.seed; C.battle = c.battle; C.rev = m.rev | 0; if(C.state === 'playing') return; if(C.state !== 'lobby' && C.state !== 'ready') return; play(!!m.resume); }
    else if(m.k === 'end') finish(String(m.reason || 'peer-ended').slice(0, 32), true); }
  function onBin(u){ const kind = netMsgKind(u);
    if(kind === NET_MSG.PING){ tr.send(packPing(NET_MSG.PONG, unpackPing(u).time), true); return; }
    if(kind === NET_MSG.PONG){ if(unpackPing(u).time !== pingSent >>> 0) return; const r = now() - pingSent; if(r >= 0 && r < 60000){ C.rtt = C.pongs ? C.rtt * 0.7 + r * 0.3 : r; C.pongs++; } return; }   // (the wire carries whole ms; the fraction is kept here)
    if(kind === NET_MSG.SNAP){ if(host || C.state !== 'playing') return; const f = dec.decode(u); if(!f) return; C.stats.snapsIn++; outbox.ack(f.ackEv); interp.push(f, now()); emit('snapshot', f); inbox.take(f, onEv); return; }
    if(kind === NET_MSG.INPUT){ if(!host || C.state !== 'playing') return; unpackInput(u, rin); if(C.hasIn && !netSeqNewer(rin.seq, C.inSeq)) return;   // an older one overtaken on the way
      C.hasIn = true; C.inSeq = rin.seq; if(rin.ackTick <= C.tick) C.peerAck = rin.ackTick; C.stats.inputsIn++; outbox.ack(rin.ackEv);
      netFrameReset(pin, rin.seq, rin.time); pin.pl.set(rin.pl); pin.np = 1; interp.push(pin, now()); emit('input', netPlayerObj(rin.pl, 0, pobj), rin); inbox.take(rin, onEv); } }
  return C; }

// ---------- the game's hooks: one session a page, made only by coopStart() ----------
let _co = null; const _subs = { state:[], snapshot:[], input:[], event:[], settings:[], peer:[], error:[] };
// Reads the address (opts.search, else location.search). No ?room= → returns null and nothing at all happens. Else joins the room as the host
// (?coop=host) or the guest and returns the session. opts: { search, location, name, url, transport, now, timers, WebSocket, link }
export function coopStart(opts){ opts = opts || {}; if(_co && _co.state !== 'ended') return _co; const loc = opts.location || globalThis.location, q = coopParseUrl(opts.search != null ? opts.search : loc ? loc.search : ''); if(!q) return null;
  const role = q.host ? 'host' : 'guest', name = opts.name || q.name, tr = opts.transport || createWsTransport(opts.url || coopWsUrl(loc, q.room, role, name), opts);
  const co = createCoopSession({ role, room:q.room, name, transport:tr, now:opts.now, timers:opts.timers });
  for(const k of Object.keys(_subs)) co.on(k, (a, b, c, d, e, f, g) => { const l = _subs[k]; for(let i = 0; i < l.length; i++) l[i](a, b, c, d, e, f, g); });
  _co = co; co.start(); return co; }
export function coopStop(reason){ if(_co) _co.stop(reason); }
export function coopSession(){ return _co; }
export function coopActive(){ return !!_co && _co.state !== 'idle' && _co.state !== 'ended'; }   // a room is joined (lobby or battle)
export function coopPlaying(){ return !!_co && _co.state === 'playing'; }
export function coopIsHost(){ return !!_co && _co.isHost; }
export function coopState(){ return _co ? _co.state : 'idle'; }
export function coopOnState(fn){ _subs.state.push(fn); }         // fn(state, before, reason)
export function coopOnSnapshot(fn){ _subs.snapshot.push(fn); }   // guest: fn(frame) — the decoded snapshot as it arrives (for the drawn world use coopSample)
export function coopOnInput(fn){ _subs.input.push(fn); }         // host: fn(playerState, input) — the guest's soldier as it arrives
export function coopOnEvent(fn){ _subs.event.push(fn); }         // fn(type, a, b, x, y, z, p) — once each, in order
export function coopOnSettings(fn){ _subs.settings.push(fn); }   // fn(seed, battle)
export function coopOnPeer(fn){ _subs.peer.push(fn); }           // fn(present, name)
export function coopSetSettings(s){ return _co ? _co.setSettings(s) : false; }
export function coopSetReady(on){ return _co ? _co.setReady(on) : false; }
export function coopBegin(){ return _co ? _co.begin() : false; }
export function coopFrame(){ return _co ? _co.frame() : null; }
export function coopBroadcast(snapshot){ return _co ? _co.broadcast(snapshot) : 0; }
export function coopSendInput(state){ return _co ? _co.sendInput(state) : 0; }
export function coopSendEvent(type, a, b, x, y, z, p){ return _co ? _co.sendEvent(type, a, b, x, y, z, p) : 0; }
export function coopSample(nowMs, out){ return _co ? _co.sample(nowMs, out) : null; }
export function coopSnapDue(nowMs){ return !!_co && _co.state === 'playing' && _co.isHost && _co.snapDue(nowMs); }
export function coopInputDue(nowMs){ return !!_co && _co.state === 'playing' && !_co.isHost && _co.inputDue(nowMs); }
export function coopInfo(){ return _co ? { room:_co.room, role:_co.role, state:_co.state, reason:_co.reason, peer:_co.peer, peerName:_co.peerName, ready:_co.ready, peerReady:_co.peerReady, seed:_co.seed, battle:_co.battle, rtt:_co.rtt || _co.transport.rtt || 0, stats:_co.stats } : null; }
