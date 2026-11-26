#!/usr/bin/env node
// tools/lan-room.mjs — COOP 1 THE LAN ROOM: one small server on the host's machine that serves the game AND relays the two players' messages.
//   node tools/lan-room.mjs [--port 8777] [--root <repo>] [--host 0.0.0.0] [--code ABCDE]
// It prints the address the second device opens (http://<this machine's LAN IP>:<port>/?room=CODE). Zero dependencies: the WebSocket side (RFC 6455
// handshake, text / binary frames, masking, fragments, ping / pong, close) is written here on Node's http + crypto.
//   GET  /…                      the repo as static files — code never cached, /assets/ cached for a day (same as tools/ts.mjs)
//   GET  /lan-room/info          { ok, port, ips } (+ the suggested room code when asked from this machine) — what a "Tạo phòng LAN" screen shows
//   WS   /ws?room=CODE&role=host|guest&name=…    ONE host and ONE guest per room; every frame from one side goes to the other, untouched.
// What the server itself says is always a TEXT frame that starts with {"sys": … (a client frame starting that way is never relayed):
//   → {"sys":"joined","room","role","peer":bool,"peerName"}     you are in          → {"sys":"peer-join","role","name"} / {"sys":"peer-leave","role"}
//   → {"sys":"error","code":"no-room"|"room-full"|"bad-request","msg"} then close 4404 / 4409 / 4400 (codes 44xx = do not retry)
//   ← {"sys":"ping","t":n}  → {"sys":"pong","t":n}               round-trip time for the browser (its WebSocket API has no ping of its own)
// A room is made by its host joining, kept while anyone is in it, and dropped `graceMs` after the last one left (so both may reconnect in any order).
// A heartbeat (a ping frame every `heartbeatMs`) drops sockets that stopped answering. Binary frames to a peer that is not reading (its buffer over
// `backlogBytes`) are dropped — the game protocol sends deltas against what the peer acknowledged, so a lost snapshot heals itself; text never is.
// Also a module: `import { startLanRoom } from './lan-room.mjs'` → { port, rooms, stats, urls(), dropAll(), close() } (tools/coop-test.mjs uses it).
import http from 'node:http'; import crypto from 'node:crypto'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const DEF = { port:8777, host:'0.0.0.0', maxPayload:65536, heartbeatMs:5000, graceMs:20000, backlogBytes:262144, nameMax:24 };
const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O, 1/I/L: read aloud across a room
export function roomCode(n = 5){ let s = ''; for(let i = 0; i < n; i++) s += CODE_ABC[crypto.randomInt(CODE_ABC.length)]; return s; }
export function lanIPs(){ const out = []; for(const list of Object.values(os.networkInterfaces())) for(const a of list || []) if(a.family === 'IPv4' && !a.internal) out.push(a.address); return out; }

const MIME = { '.js':'text/javascript', '.mjs':'text/javascript', '.html':'text/html; charset=utf-8', '.css':'text/css', '.json':'application/json', '.glb':'model/gltf-binary', '.gltf':'model/gltf+json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ktx2':'image/ktx2', '.svg':'image/svg+xml', '.wasm':'application/wasm', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.wav':'audio/wav', '.hdr':'application/octet-stream', '.bin':'application/octet-stream', '.woff2':'font/woff2', '.ico':'image/x-icon', '.txt':'text/plain; charset=utf-8', '.csv':'text/csv; charset=utf-8', '.md':'text/markdown; charset=utf-8' };

// one frame, server → client (never masked)
function frame(op, payload){ const n = payload.length; let h;
  if(n < 126){ h = Buffer.allocUnsafe(2); h[1] = n; } else if(n < 65536){ h = Buffer.allocUnsafe(4); h[1] = 126; h.writeUInt16BE(n, 2); } else { h = Buffer.allocUnsafe(10); h[1] = 127; h.writeUInt32BE(0, 2); h.writeUInt32BE(n, 6); }
  h[0] = 0x80 | op; return n ? Buffer.concat([h, payload], h.length + n) : h; }
const EMPTY = Buffer.alloc(0);

export function startLanRoom(opts = {}){
  const O = Object.assign({}, DEF, opts), ROOT = path.resolve(O.root || path.dirname(HERE)), code = (O.code || roomCode()).toUpperCase();
  const rooms = new Map(), conns = new Set(), stats = { relayed:0, relayedBytes:0, dropped:0, noPeer:0, joins:0, rejects:0 };
  const log = O.quiet ? () => {} : (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);

  // ---------- static files ----------
  const srv = http.createServer((q, r) => { let u; try{ u = decodeURIComponent((q.url || '/').split('?')[0]); }catch(e){ r.writeHead(400); return r.end(); }
    if(q.method !== 'GET' && q.method !== 'HEAD'){ r.writeHead(405, { Allow:'GET, HEAD' }); return r.end(); }
    if(u === '/lan-room/info'){ const local = /^(::1|::ffff:127\.|127\.)/.test(q.socket.remoteAddress || ''), body = JSON.stringify(Object.assign({ ok:true, port:srv.address().port, ips:lanIPs() }, local ? { code } : {}));
      r.writeHead(200, { 'Content-Type':'application/json', 'Cache-Control':'no-store' }); return r.end(body); }
    if(u.endsWith('/')) u += 'index.html';
    // nothing hidden and nothing outside the root: no dot-files (.git, .env …), no node_modules, no path that climbs out
    if(u.includes('\0') || u.split('/').some(s => s.startsWith('.') || s === 'node_modules')){ r.writeHead(403); return r.end('403'); }
    const f = path.join(ROOT, u); if(f !== ROOT && !f.startsWith(ROOT + path.sep)){ r.writeHead(403); return r.end('403'); }
    fs.stat(f, (e, st) => { if(e || !st.isFile()){ r.writeHead(404); return r.end('404'); }
      r.writeHead(200, { 'Content-Type':MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Content-Length':st.size, 'Cache-Control':u.startsWith('/assets/') ? 'max-age=86400' : 'no-store' });
      if(q.method === 'HEAD') return r.end(); fs.createReadStream(f).on('error', () => r.destroy()).pipe(r); }); });

  // ---------- the WebSocket side ----------
  const sendText = (c, obj) => { if(!c.dead) c.sock.write(frame(1, Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)))); };
  function shut(c, wsCode, reason){ if(c.dead) return; if(!c.closing){ c.closing = true; const b = Buffer.allocUnsafe(2 + Buffer.byteLength(reason || '')); b.writeUInt16BE(wsCode, 0); b.write(reason || '', 2);
      try{ c.sock.write(frame(8, b)); c.sock.end(); }catch(e){} c.killT = setTimeout(() => c.sock.destroy(), 1500); c.killT.unref(); } }
  function gone(c){ if(c.dead) return; c.dead = true; clearTimeout(c.killT); conns.delete(c); const room = c.room; if(!room) return; c.room = null;
    if(room[c.role] !== c) return; room[c.role] = null; const other = room[c.role === 'host' ? 'guest' : 'host'];
    log(`[${room.code}] ${c.role} "${c.name}" left`); if(other) sendText(other, { sys:'peer-leave', role:c.role });
    if(!room.host && !room.guest){ room.emptyT = setTimeout(() => { if(!room.host && !room.guest && rooms.get(room.code) === room){ rooms.delete(room.code); log(`[${room.code}] room dropped (empty)`); } }, O.graceMs); room.emptyT.unref(); } }
  function refuse(c, wsCode, errCode, msg){ stats.rejects++; sendText(c, { sys:'error', code:errCode, msg }); shut(c, wsCode, errCode); }
  function join(c, q){ const rc = String(q.get('room') || '').toUpperCase(), role = q.get('role');
    c.name = String(q.get('name') || '').replace(/[\u0000-\u001f"\\<>]/g, '').slice(0, O.nameMax) || (role === 'host' ? 'Chủ phòng' : 'Khách');
    if(!/^[A-Z0-9]{3,12}$/.test(rc) || (role !== 'host' && role !== 'guest')) return refuse(c, 4400, 'bad-request', 'room=CODE&role=host|guest');
    let room = rooms.get(rc);
    if(!room){ if(role !== 'host') return refuse(c, 4404, 'no-room', 'no such room'); room = { code:rc, host:null, guest:null, emptyT:null, made:Date.now(), toGuest:0, toHost:0, toGuestBytes:0, toHostBytes:0 }; rooms.set(rc, room); }
    if(room[role]) return refuse(c, 4409, 'room-full', role === 'host' ? 'this room already has a host' : 'this room already has two players');
    clearTimeout(room.emptyT); room[role] = c; c.room = room; c.role = role; stats.joins++; const other = room[role === 'host' ? 'guest' : 'host'];
    log(`[${rc}] ${role} "${c.name}" joined` + (other ? ' — both in' : ''));
    sendText(c, { sys:'joined', room:rc, role, peer:!!other, peerName:other ? other.name : '' }); if(other) sendText(other, { sys:'peer-join', role, name:c.name }); }
  function message(c, op, data){   // one whole message from a client: answer a sys ping, else hand it to the other side as it is
    if(op === 1 && data.length < 256 && data[0] === 0x7b && data.subarray(0, 6).toString() === '{"sys"'){ let m = null; try{ m = JSON.parse(data.toString()); }catch(e){}
      if(m && m.sys === 'ping') sendText(c, { sys:'pong', t:m.t }); return; }
    const room = c.room; if(!room) return; const to = room[c.role === 'host' ? 'guest' : 'host']; if(!to || to.dead){ stats.noPeer++; return; }
    if(op === 2 && to.sock.writableLength > O.backlogBytes){ stats.dropped++; return; }
    to.sock.write(frame(op, data)); stats.relayed++; stats.relayedBytes += data.length;
    if(c.role === 'host'){ room.toGuest++; room.toGuestBytes += data.length; } else { room.toHost++; room.toHostBytes += data.length; } }
  function feed(c, chunk){ c.alive = true; let buf = c.buf.length ? Buffer.concat([c.buf, chunk]) : chunk;
    while(!c.closing && !c.dead){ if(buf.length < 2) break; const b0 = buf[0], b1 = buf[1], fin = b0 & 0x80, op = b0 & 0x0f; let len = b1 & 0x7f, off = 2;
      if(b0 & 0x70) return shut(c, 1002, 'rsv bits'); if(!(b1 & 0x80)) return shut(c, 1002, 'client frames must be masked');
      if(len === 126){ if(buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; } else if(len === 127){ if(buf.length < 10) break; if(buf.readUInt32BE(2)) return shut(c, 1009, 'too big'); len = buf.readUInt32BE(6); off = 10; }
      if(len > O.maxPayload) return shut(c, 1009, 'too big'); if(op >= 8 && (len > 125 || !fin)) return shut(c, 1002, 'bad control frame');
      if(buf.length < off + 4 + len) break;
      const data = Buffer.allocUnsafe(len), m0 = buf[off], m1 = buf[off + 1], m2 = buf[off + 2], m3 = buf[off + 3], p = off + 4;
      for(let i = 0; i < len; i++) data[i] = buf[p + i] ^ ((i & 3) === 0 ? m0 : (i & 3) === 1 ? m1 : (i & 3) === 2 ? m2 : m3);
      buf = buf.subarray(p + len);
      if(op === 8){ shut(c, len >= 2 ? data.readUInt16BE(0) : 1000, ''); break; }
      else if(op === 9) c.sock.write(frame(10, data));
      else if(op === 10){ /* a pong: alive (already marked) */ }
      else if(op === 0){ if(!c.fragOp) return shut(c, 1002, 'continuation without a start'); c.fragLen += len; if(c.fragLen > O.maxPayload) return shut(c, 1009, 'too big'); c.frag.push(data);
        if(fin){ const whole = Buffer.concat(c.frag, c.fragLen), fop = c.fragOp; c.frag = []; c.fragLen = 0; c.fragOp = 0; message(c, fop, whole); } }
      else if(op === 1 || op === 2){ if(c.fragOp) return shut(c, 1002, 'new message inside a fragmented one'); if(fin) message(c, op, data); else { c.fragOp = op; c.frag = [data]; c.fragLen = len; } }
      else return shut(c, 1002, 'unknown opcode'); }
    c.buf = buf.length ? Buffer.from(buf) : EMPTY; }
  srv.on('upgrade', (q, sock, head) => { let url; try{ url = new URL(q.url, 'http://x'); }catch(e){ return sock.destroy(); }
    const key = q.headers['sec-websocket-key'], origin = q.headers.origin;
    const bad = (st, why) => { sock.end(`HTTP/1.1 ${st}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); log('refused upgrade: ' + why); };
    if(url.pathname !== '/ws') return bad('404 Not Found', 'path ' + url.pathname);
    if(!key || String(q.headers.upgrade || '').toLowerCase() !== 'websocket' || q.headers['sec-websocket-version'] !== '13') return bad('400 Bad Request', 'not a WebSocket v13 handshake');
    // a page may only talk to the server it came from (a browser always sends Origin; a tool such as the Node test sends none)
    if(origin){ let oh = ''; try{ oh = new URL(origin).host; }catch(e){} if(oh !== q.headers.host) return bad('403 Forbidden', 'origin ' + origin); }
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + crypto.createHash('sha1').update(key + WS_GUID).digest('base64') + '\r\n\r\n');
    sock.setNoDelay(true);
    const c = { sock, buf:EMPTY, frag:[], fragLen:0, fragOp:0, alive:true, closing:false, dead:false, room:null, role:'', name:'', killT:null }; conns.add(c);
    sock.on('data', d => { try{ feed(c, d); }catch(e){ log('frame error: ' + e.message); shut(c, 1011, 'server error'); } });
    sock.on('close', () => gone(c)); sock.on('error', () => { sock.destroy(); gone(c); });
    join(c, url.searchParams); if(head && head.length) feed(c, head); });

  // the heartbeat: whoever did not answer the last ping (nor send anything) is gone
  const beat = setInterval(() => { for(const c of conns){ if(!c.alive){ c.sock.destroy(); gone(c); continue; } c.alive = false; try{ c.sock.write(frame(9, EMPTY)); }catch(e){} } }, O.heartbeatMs); beat.unref();

  const api = { server:srv, rooms, conns, stats, code, root:ROOT, port:0,
    urls(){ const p = srv.address().port; return { host:`http://localhost:${p}/?room=${code}&coop=host`, guests:lanIPs().map(ip => `http://${ip}:${p}/?room=${code}`) }; },
    dropAll(){ let n = 0; for(const c of [...conns]){ c.sock.destroy(); n++; } return n; },   // the cable pulled (tests: the clients must come back by themselves)
    close(){ clearInterval(beat); for(const r of rooms.values()) clearTimeout(r.emptyT); for(const c of [...conns]){ clearTimeout(c.killT); c.sock.destroy(); } rooms.clear();
      return new Promise(ok => { srv.close(() => ok()); if(srv.closeAllConnections) srv.closeAllConnections(); }); } };
  return new Promise((ok, no) => { srv.once('error', no); srv.listen(O.port, O.host, () => { srv.removeListener('error', no); api.port = srv.address().port; ok(api); }); });
}

// ---------- run from the command line ----------
const isMain = (() => { try{ return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); }catch(e){ return false; } })();
if(isMain){ const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  if(argv.includes('--help') || argv.includes('-h')){ console.log('usage: node tools/lan-room.mjs [--port 8777] [--root <thư mục game>] [--host 0.0.0.0] [--code ABCDE]'); process.exit(0); }
  const port = +opt('--port', DEF.port), root = opt('--root', path.dirname(HERE));
  if(!Number.isInteger(port) || port < 0 || port > 65535){ console.error('✗ --port phải là số 0–65535'); process.exit(2); }
  if(!fs.existsSync(path.join(root, 'index.html'))){ console.error('✗ không thấy index.html trong ' + path.resolve(root) + ' — dùng --root <thư mục game>'); process.exit(2); }
  startLanRoom({ port, root, host:opt('--host', DEF.host), code:opt('--code', '') }).then(room => { const u = room.urls();
    console.log('\nXUNG KÍCH — PHÒNG LAN (co-op 2 người)   mã phòng: ' + room.code + '\n');
    console.log('  Chủ phòng (máy này):   ' + u.host);
    if(u.guests.length) for(const g of u.guests) console.log('  Khách (cùng Wi-Fi):    ' + g);
    else console.log('  ⚠ Máy này chưa nối mạng LAN nào (không có IPv4 ngoài) — nối Wi-Fi / hotspot rồi chạy lại.');
    console.log('\n  • Khách phải mở đúng địa chỉ http:// ở trên (không mở bản GitHub Pages https).');
    console.log('  • macOS hỏi "cho phép node nhận kết nối?" → bấm Cho phép.   • Wi-Fi văn phòng chặn máy-tới-máy: dùng Wi-Fi nhà hoặc hotspot.');
    console.log('  • Ctrl+C để đóng phòng.\n');
    const bye = () => { room.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 800).unref(); }; process.on('SIGINT', bye); process.on('SIGTERM', bye);
  }).catch(e => { console.error(e.code === 'EADDRINUSE' ? `✗ cổng ${port} đang bận — thử: node tools/lan-room.mjs --port ${port + 1}` : '✗ ' + e.message); process.exit(1); });
}
