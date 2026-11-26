// net/transport.js — COOP 2 THE LINE between the two players: the transport interface the game talks to (never to a socket directly), its WebSocket form for the LAN room (reconnects with a back-off, queues lobby messages while closed, measures the round trip) and an in-memory pair for tests — runs in Node 22 too
import { COOP } from '../../config.js';
import { netRand } from './protocol.js';

// THE TRANSPORT INTERFACE (a WebRTC DataChannel version later only has to offer the same):
//   open()                          start (and keep) the line; close() ends it for good
//   send(data, volatile) → bool     data = a string (lobby, JSON) or a Uint8Array (game). volatile = worthless a moment later (snapshots, inputs):
//                                   dropped when the line is not open; anything else waits in a queue (COOP.link.queueMax) and goes out on reconnect
//   onOpen(fn())                    the line is up (again)
//   onMessage(fn(data, isBinary))   one message from the PEER (a string or a Uint8Array)
//   onNotice(fn(note))              the room speaks: { sys:'joined', role, peer, peerName } · { sys:'peer-join', name } · { sys:'peer-leave' } · { sys:'error', code }
//   onClose(fn({ code, reason, fatal, retry }))   the line went down; retry = it is coming back by itself, fatal = it was refused (no such room, room full)
//   state 'idle' | 'connecting' | 'open' | 'closed' · rtt (ms, to the relay; stats.pongs = how many times it was measured) · stats { bytesOut, bytesIn, msgsOut, msgsIn, opens, retries, queued, dropped, pongs }
function makeSubs(){ const L = { open:[], close:[], message:[], notice:[] };
  return { L, emit(k, a, b){ const l = L[k]; for(let i = 0; i < l.length; i++){ try{ l[i](a, b); }catch(e){ console.error('coop transport: a ' + k + ' handler threw', e); } } } }; }
function makeStats(){ return { bytesOut:0, bytesIn:0, msgsOut:0, msgsIn:0, opens:0, retries:0, queued:0, dropped:0, pongs:0 }; }
const sizeOf = d => typeof d === 'string' ? d.length : d.byteLength;

// opts: { WebSocket (default the global one), now() → ms (default performance.now), link:{ … overrides of COOP.link } }
export function createWsTransport(url, opts){ opts = opts || {}; const K = Object.assign({}, COOP.link, opts.link), now = opts.now || (() => performance.now()), subs = makeSubs(), queue = [];
  let ws = null, want = false, tries = 0, retryT = null, pingT = null, lastIn = 0, pingN = 0, pingAt = 0;
  const T = { url, state:'idle', rtt:0, lastClose:null, stats:makeStats(),
    onOpen(fn){ subs.L.open.push(fn); return T; }, onClose(fn){ subs.L.close.push(fn); return T; }, onMessage(fn){ subs.L.message.push(fn); return T; }, onNotice(fn){ subs.L.notice.push(fn); return T; },
    open(){ if(want) return T; want = true; tries = 0; connect(); return T; },
    close(){ want = false; clearTimeout(retryT); retryT = null; stopPing(); queue.length = 0; const w = ws; ws = null; if(w){ unhook(w); try{ w.close(1000, 'bye'); }catch(e){} } if(T.state !== 'closed' && T.state !== 'idle'){ T.state = 'closed'; T.lastClose = { code:1000, reason:'bye', fatal:false, retry:false }; subs.emit('close', T.lastClose); } else T.state = 'closed'; },
    send(data, volatile){ if(ws && T.state === 'open'){ try{ ws.send(data); T.stats.msgsOut++; T.stats.bytesOut += sizeOf(data); return true; }catch(e){ /* the socket died under us: the close event follows */ } }
      if(volatile || !want){ T.stats.dropped++; return false; } if(queue.length >= K.queueMax){ queue.shift(); T.stats.dropped++; } queue.push(data); T.stats.queued++; return false; } };
  function unhook(w){ w.onopen = w.onmessage = w.onclose = w.onerror = null; }
  function stopPing(){ clearInterval(pingT); pingT = null; }
  function down(code, reason){ stopPing(); ws = null; const fatal = code >= 4400 && code < 4500, retry = want && !fatal && tries < K.retries;
    T.state = retry ? 'connecting' : 'closed'; if(!retry) want = false; T.lastClose = { code, reason:reason || '', fatal, retry }; subs.emit('close', T.lastClose);
    if(retry){ const d = Math.min(K.retryMaxMs, K.retryBaseMs * Math.pow(K.retryK, tries)) * (1 + (netRand() * 2 - 1) * K.retryJitter); tries++; T.stats.retries++; retryT = setTimeout(connect, d); } }
  function connect(){ retryT = null; if(!want) return; const WS = opts.WebSocket || globalThis.WebSocket; if(!WS){ want = false; T.state = 'closed'; T.lastClose = { code:0, reason:'no WebSocket here', fatal:true, retry:false }; subs.emit('close', T.lastClose); return; }
    T.state = 'connecting'; let w; try{ w = new WS(url); }catch(e){ down(1006, String(e && e.message || e)); return; } ws = w; w.binaryType = 'arraybuffer';
    w.onopen = () => { if(ws !== w) return; T.state = 'open'; tries = 0; T.stats.opens++; lastIn = now();
      pingT = setInterval(() => { if(ws !== w) return; if(now() - lastIn > K.deadMs){ unhook(w); try{ w.close(); }catch(e){} down(4000, 'silent for ' + K.deadMs + ' ms'); return; } pingN = (pingN + 1) % 1e9; pingAt = now(); try{ w.send('{"sys":"ping","t":' + pingN + '}'); }catch(e){} }, K.pingMs);
      while(queue.length && ws === w){ const d = queue.shift(); try{ w.send(d); T.stats.msgsOut++; T.stats.bytesOut += sizeOf(d); }catch(e){ queue.unshift(d); break; } }
      subs.emit('open'); };
    w.onmessage = e => { if(ws !== w) return; lastIn = now(); const d = e.data;
      if(typeof d === 'string'){ if(d.charCodeAt(0) === 123 && d.startsWith('{"sys"')){ let m = null; try{ m = JSON.parse(d); }catch(e2){} if(!m) return;
          if(m.sys === 'pong'){ if(m.t !== pingN) return; const r = now() - pingAt; if(r >= 0 && r < 60000){ T.rtt = T.stats.pongs ? T.rtt * 0.7 + r * 0.3 : r; T.stats.pongs++; } } else subs.emit('notice', m); return; }
        T.stats.msgsIn++; T.stats.bytesIn += d.length; subs.emit('message', d, false); }
      else { const u = new Uint8Array(d); T.stats.msgsIn++; T.stats.bytesIn += u.byteLength; subs.emit('message', u, true); } };
    w.onerror = () => {};   // (a close always follows; the reason is there)
    w.onclose = e => { if(ws !== w) return; unhook(w); down(e.code || 1006, e.reason); }; }
  return T; }

// Two transports wired to each other in memory, speaking as the LAN room does (joined / peer-join / peer-leave) — for tests of the session without a socket.
// opts: { delayMs (0 = delivered at once, inside send), loss (0–1, volatile messages only), rng() }
export function createLoopbackPair(opts){ opts = opts || {}; const delay = opts.delayMs || 0, loss = opts.loss || 0, rng = opts.rng || netRand;
  function end(role, name){ const subs = makeSubs(); const T = { role, name, state:'idle', rtt:delay * 2, lastClose:null, stats:makeStats(), other:null, subs,
      onOpen(fn){ subs.L.open.push(fn); return T; }, onClose(fn){ subs.L.close.push(fn); return T; }, onMessage(fn){ subs.L.message.push(fn); return T; }, onNotice(fn){ subs.L.notice.push(fn); return T; },
      open(){ if(T.state === 'open') return T; T.state = 'open'; T.stats.opens++; const o = T.other, up = o.state === 'open'; subs.emit('open'); subs.emit('notice', { sys:'joined', room:'LOOP', role, peer:up, peerName:up ? o.name : '' }); if(up) o.subs.emit('notice', { sys:'peer-join', role, name }); return T; },
      close(){ if(T.state !== 'open'){ T.state = 'closed'; return; } T.state = 'closed'; T.lastClose = { code:1000, reason:'bye', fatal:false, retry:false }; subs.emit('close', T.lastClose); if(T.other.state === 'open') T.other.subs.emit('notice', { sys:'peer-leave', role }); },
      send(data, volatile){ const o = T.other; if(T.state !== 'open'){ T.stats.dropped++; return false; } T.stats.msgsOut++; T.stats.bytesOut += sizeOf(data);
        if(o.state !== 'open' || (volatile && loss && rng() < loss)) return true;   // (sent, and lost on the way)
        const d = typeof data === 'string' ? data : data.slice(), bin = typeof d !== 'string', go = () => { if(o.state !== 'open') return; o.stats.msgsIn++; o.stats.bytesIn += sizeOf(d); o.subs.emit('message', d, bin); };
        if(delay) setTimeout(go, delay); else go(); return true; } };
    return T; }
  const a = end('host', opts.hostName || 'Chủ phòng'), b = end('guest', opts.guestName || 'Khách'); a.other = b; b.other = a; return [a, b]; }
