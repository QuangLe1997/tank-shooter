// net/protocol.js — COOP 2 THE WIRE FORMAT of two-player co-op: message kinds, version, quantisers, the frame a snapshot is built in, binary packing of a player state / a world snapshot (full, or a delta against one the peer acknowledged) / an input, the resent-until-acknowledged event queue, the lobby's JSON — PURE (no three, no DOM, no hub: it runs in Node)
import { COOP } from '../../config.js';

// Every binary message: byte 0 = kind (NET_MSG), byte 1 = version (NET_PROTO); numbers little-endian. Lobby messages are JSON text {"k":kind,"v":version,…}.
//   SNAP  host → guest   u8 kind · u8 ver · u32 tick · u8 back (0 = full, else a delta against snapshot tick − back) · u32 host time ms · u16 ackInput (the
//         guest's last input seq) · u16 ackEv (the guest's last event seq applied) · u16 evSeq (seq of this message's first event) · u8 players · u8 records ·
//         u8 gone · u8 events | players × 26 B | gone ids (delta only) | entity records | events × 13 B
//         an id is written as the gap from the one before it (lists are sorted by id) in a varint: 1 byte for a gap under 128
//         full record:  id · u8 kind · i16 x · i16 z · i16 y · u8 heading · u8 state · u8 hp                                   (11 B with a 1-byte id)
//         delta record: id · u8 mask · [1: i8 dx, i8 dz] [2: i16 x, i16 z] [4: i16 y] [8: u8 heading] [16: u8 state] [32: u8 hp] [64: u8 kind]
//                       mask 128 = not in the base: the full record's fields follow. An entity that did not change is not written at all.
//   INPUT guest → host   u8 kind · u8 ver · u16 seq · u32 ackTick (the newest snapshot he holds; 0 = send a full one) · u32 guest time ms · u16 ackEv ·
//         u16 evSeq · u8 events | player 26 B | events × 13 B
//   PING / PONG          u8 kind · u8 ver · u32 the sender's clock ms (the pong sends it back)
//   player (26 B): u8 id · i16 x, y, z · u16 heading · u16 aim yaw · i16 aim pitch · i16 vx, vz (cm/s) · u8 stance · u8 weapon · u8 flags · u16 hp · u16 hpMax · u16 mount id
//   event  (13 B): u8 type · u16 a (who) · u16 b (whom / what) · i16 x, y, z · u16 p (a parameter: weapon, damage, radius ×10, cue id …)
// Positions are centimetres (COOP.quant.pos) in an int16; an entity's heading is a byte (1.4°), a player's angles 16 bit.
const Q = COOP.quant, LIM = COOP.limits, TAU = Math.PI * 2, HEAD = Q.head, AIM = Q.aim;
export const NET_PROTO = COOP.proto;
export const NET_MSG = { SNAP:1, INPUT:2, PING:3, PONG:4 };
export const NET_CTL = ['hello', 'settings', 'ready', 'start', 'end', 'field', 'say'];   // (COOP 6 say: a line of the host's radio for the guest's)
export const NET_EV = { SHOT:1, HIT:2, DEATH:3, EXPLOSION:4, GRENADE:5, RADIO:6, MARK:7, CUE:8, BLOCK:9, GUARD:10, LOOT:11, PING:12, GIVE:13, STATE:14 };   // (COOP 9: 9–14, their fields in net/rules.js)
export const NET_PFLAG = { FIRING:1, RELOADING:2, MOUNTED:4, DOWNED:8, AIMING:16, SPRINT:32, AIRBORNE:64, DEAD:128 };
export const NET_STANCE = { STAND:0, CROUCH:1, PRONE:2, CLIMB:3, HORSE:4, PILLION:5, SLUNG:16, BLADE:32, SWIM:64, DIVE:128 };   // (CARRY 1 SLUNG: a bit OR-ed onto STAND — his rifle is on his back; a page that does not know it still reads "stood" · BLADE 3 BLADE: one more such bit — his blade is in his hands · SWIM 1 SWIM / DIVE: he swims / is under the water)
// an entity's state byte: bits 0–2 its pose (NET_POSE), then flags
export const NET_ESTATE = { POSE:0x07, FIRING:0x08, RELOADING:0x10, COVER:0x20, ELITE:0x40, ALLY:0x80 };
export const NET_POSE = { STAND:0, RUN:1, CROUCH:2, PRONE:3, CLIMB:4, MOUNTED:5, STUNNED:6, DOWN:7 };
export const NET_PLAYER_BYTES = 26;
export const NET_EVENT_BYTES = 13;
// the three flat tables of a frame (ints, already quantised): stride and field order
export const NET_ES = 8;    // ent: id, kind, x, y, z, heading (0–255), state, hp (0–255)
export const NET_PS = 16;   // pl:  id, x, y, z, heading, aimYaw (0–65535), aimPitch (±32767 = ±90°), vx, vz, stance, weapon, flags, hp, hpMax, mount, 0
export const NET_VS = 8;    // ev:  type, a, b, x, y, z, p, 0

export class CoopProtocolError extends Error { constructor(code, msg){ super('coop protocol [' + code + ']: ' + msg); this.name = 'CoopProtocolError'; this.code = code; } }
function bad(code, msg){ throw new CoopProtocolError(code, msg); }

// ---------- quantisers (metres / radians / 0–1 → the wire's integers, and back) ----------
export function netQPos(m){ const v = Math.round(m * Q.pos); return v > 32767 ? 32767 : v < -32767 ? -32767 : v === v ? v : 0; }
export function netQAng(rad, steps){ const v = Math.round(rad / TAU * steps) % steps; return v < 0 ? v + steps : v === v ? v + 0 : 0; }
export function netQPitch(rad){ const v = Math.round(rad / (Math.PI / 2) * 32767); return v > 32767 ? 32767 : v < -32767 ? -32767 : v === v ? v : 0; }
export function netQHp(f){ return f > 0 ? Math.max(1, Math.min(255, Math.round(f * 255))) : 0; }   // (a living thing never reads 0)
export function netUPos(q){ return q / Q.pos; }
export function netUAng(q, steps){ return q * TAU / steps; }
export function netUPitch(q){ return q / 32767 * (Math.PI / 2); }
const u16c = v => { v = Math.round(v); return v > 65535 ? 65535 : v > 0 ? v : 0; };
// a is newer than b on a 16-bit counter that wraps
export function netSeqNewer(a, b){ return a !== b && ((a - b) & 0xffff) < 0x8000; }
// a running fingerprint (FNV-1a over 32-bit ints): h = NET_HASH0, then h = netHashStep(h, value) for every number that must match on both pages —
// the built battlefield (heights on a grid, cover, forts, towers): the same seed must have given both the same land before a snapshot means anything
export const NET_HASH0 = 2166136261;
export function netHashStep(h, v){ return Math.imul((h ^ (v | 0)) >>> 0, 16777619) >>> 0; }
// the net layer's own dice (0–1). NEVER Math.random here: with ?seed= that is the battlefield's generator, and both pages must draw the very same numbers from it
let _rs = 0;
export function netRand(){ if(!_rs) _rs = ((Date.now() ^ (performance.now() * 1000)) >>> 0) || 1; _rs ^= _rs << 13; _rs >>>= 0; _rs ^= _rs >>> 17; _rs ^= _rs << 5; _rs >>>= 0; return _rs / 4294967296; }

// ---------- the frame: what a snapshot is built in and decoded into (reused, no garbage) ----------
export function makeNetFrame(){ return { tick:0, back:0, time:0, ackInput:0, ackEv:0, evSeq:0, n:0, ent:new Int32Array(LIM.entities * NET_ES), np:0, pl:new Int32Array(LIM.players * NET_PS), ne:0, ev:new Int32Array(LIM.events * NET_VS), over:0 }; }
export function netFrameReset(f, tick, timeMs){ f.tick = tick >>> 0; f.back = 0; f.time = timeMs >>> 0; f.n = 0; f.np = 0; f.ne = 0; f.over = 0; return f; }
// one entity into the frame (metres, radians, hp 0–1); kept sorted by id (callers add in rising order → an append). Over the cap it is left out
// (returns false, f.over counts) — add what matters most first. The same id again overwrites.
export function netFrameAdd(f, id, kind, x, y, z, heading, state, hp){ id = id | 0; if(id < 1 || id > 65535) throw new RangeError('coop: entity id ' + id + ' is not 1–65535');
  const E = f.ent; let i = f.n; while(i > 0 && E[(i - 1) * NET_ES] > id) i--;
  if(i > 0 && E[(i - 1) * NET_ES] === id) i--;
  else { if(f.n >= LIM.entities){ f.over++; return false; } if(i < f.n) E.copyWithin((i + 1) * NET_ES, i * NET_ES, f.n * NET_ES); f.n++; }
  const o = i * NET_ES; E[o] = id; E[o + 1] = kind & 255; E[o + 2] = netQPos(x); E[o + 3] = netQPos(y); E[o + 4] = netQPos(z); E[o + 5] = netQAng(heading, HEAD); E[o + 6] = state & 255; E[o + 7] = netQHp(hp); return true; }
export function netFrameEnt(f, i, out){ const E = f.ent, o = i * NET_ES; out = out || {}; out.id = E[o]; out.kind = E[o + 1]; out.x = E[o + 2] / Q.pos; out.y = E[o + 3] / Q.pos; out.z = E[o + 4] / Q.pos; out.heading = E[o + 5] * TAU / HEAD; out.state = E[o + 6]; out.hp = E[o + 7] / 255; return out; }
// index of an id in a frame (binary search), -1 = not there
export function netFrameFind(f, id){ const E = f.ent; let lo = 0, hi = f.n - 1; while(lo <= hi){ const m = (lo + hi) >> 1, v = E[m * NET_ES]; if(v === id) return m; if(v < id) lo = m + 1; else hi = m - 1; } return -1; }
// a player state { id, x, y, z, heading, aimYaw, aimPitch, vx, vz, stance, weapon, flags, hp, hpMax, mount } ↔ 16 ints at P[o]
export function netPlayerQ(P, o, s){ P[o] = s.id & 255; P[o + 1] = netQPos(s.x); P[o + 2] = netQPos(s.y || 0); P[o + 3] = netQPos(s.z); P[o + 4] = netQAng(s.heading || 0, AIM); P[o + 5] = netQAng(s.aimYaw || 0, AIM); P[o + 6] = netQPitch(s.aimPitch || 0);
  P[o + 7] = netQPos(s.vx || 0); P[o + 8] = netQPos(s.vz || 0); P[o + 9] = s.stance & 255; P[o + 10] = s.weapon & 255; P[o + 11] = s.flags & 255; P[o + 12] = u16c(s.hp || 0); P[o + 13] = u16c(s.hpMax || 0); P[o + 14] = (s.mount | 0) & 0xffff; P[o + 15] = 0; }
export function netPlayerObj(P, o, out){ out = out || {}; out.id = P[o]; out.x = P[o + 1] / Q.pos; out.y = P[o + 2] / Q.pos; out.z = P[o + 3] / Q.pos; out.heading = P[o + 4] * TAU / AIM; out.aimYaw = P[o + 5] * TAU / AIM; out.aimPitch = netUPitch(P[o + 6]);
  out.vx = P[o + 7] / Q.pos; out.vz = P[o + 8] / Q.pos; out.stance = P[o + 9]; out.weapon = P[o + 10]; out.flags = P[o + 11]; out.hp = P[o + 12]; out.hpMax = P[o + 13]; out.mount = P[o + 14]; return out; }
export function netFramePlayer(f, s){ if(f.np >= LIM.players) return false; netPlayerQ(f.pl, f.np * NET_PS, s); f.np++; return true; }
// an event into a frame / an input (positions in metres); false when the message is full
export function netFrameEvent(f, type, a, b, x, y, z, p){ if(f.ne >= LIM.events) return false; const V = f.ev, o = f.ne * NET_VS; V[o] = type & 255; V[o + 1] = a & 0xffff; V[o + 2] = b & 0xffff; V[o + 3] = netQPos(x); V[o + 4] = netQPos(y); V[o + 5] = netQPos(z); V[o + 6] = p & 0xffff; V[o + 7] = 0; f.ne++; return true; }
// what the guest sends: his own soldier + his events
export function makeNetInput(){ return { seq:0, ackTick:0, time:0, ackEv:0, evSeq:0, pl:new Int32Array(NET_PS), ne:0, ev:new Int32Array(LIM.events * NET_VS) }; }

// ---------- writing ----------
const _wb = new Uint8Array(8192), _wv = new DataView(_wb.buffer); let _w = 0;   // (the biggest snapshot: 21 + 2×26 + 120×(3+11) + 120×3 + 48×13 ≈ 2.7 KB)
function w8(v){ _wb[_w++] = v; }
function w16(v){ _wv.setUint16(_w, v, true); _w += 2; }
function wi16(v){ _wv.setInt16(_w, v, true); _w += 2; }
function w32(v){ _wv.setUint32(_w, v, true); _w += 4; }
function wVar(v){ while(v >= 128){ _wb[_w++] = (v & 127) | 128; v >>>= 7; } _wb[_w++] = v; }
function wPlayer(P, o){ w8(P[o]); wi16(P[o + 1]); wi16(P[o + 2]); wi16(P[o + 3]); w16(P[o + 4]); w16(P[o + 5]); wi16(P[o + 6]); wi16(P[o + 7]); wi16(P[o + 8]); w8(P[o + 9]); w8(P[o + 10]); w8(P[o + 11]); w16(P[o + 12]); w16(P[o + 13]); w16(P[o + 14]); }
function wEvents(V, n){ for(let k = 0; k < n; k++){ const o = k * NET_VS; w8(V[o]); w16(V[o + 1]); w16(V[o + 2]); wi16(V[o + 3]); wi16(V[o + 4]); wi16(V[o + 5]); w16(V[o + 6]); } }
function wFull(E, o){ w8(E[o + 1]); wi16(E[o + 2]); wi16(E[o + 4]); wi16(E[o + 3]); w8(E[o + 5]); w8(E[o + 6]); w8(E[o + 7]); }
// a snapshot → bytes. base = the frame (or { tick, n, ent }) the peer is known to hold, null = a full snapshot
export function packSnapshot(f, base){ const back = base ? f.tick - base.tick : 0; if(base && (back < 1 || back > 255)) throw new RangeError('coop: delta base ' + base.tick + ' is not 1–255 snapshots behind ' + f.tick);
  _w = 0; w8(NET_MSG.SNAP); w8(NET_PROTO); w32(f.tick); w8(back); w32(f.time); w16(f.ackInput); w16(f.ackEv); w16(f.evSeq); w8(f.np); const cAt = _w; w8(0); w8(0); w8(f.ne);
  for(let k = 0; k < f.np; k++) wPlayer(f.pl, k * NET_PS);
  const E = f.ent, n = f.n; let rec = 0, gone = 0, last = 0;
  if(!base){ for(let i = 0; i < n; i++){ const o = i * NET_ES; wVar(E[o] - last); last = E[o]; wFull(E, o); } rec = n; }
  else { const B = base.ent, bn = base.n;
    for(let j = 0, i = 0; j < bn; j++){ const id = B[j * NET_ES]; while(i < n && E[i * NET_ES] < id) i++; if(!(i < n && E[i * NET_ES] === id)){ wVar(id - last); last = id; gone++; } }   // in the base, not here any more
    last = 0;
    for(let i = 0, j = 0; i < n; i++){ const o = i * NET_ES, id = E[o]; while(j < bn && B[j * NET_ES] < id) j++;
      if(j < bn && B[j * NET_ES] === id){ const p = j * NET_ES, dx = E[o + 2] - B[p + 2], dz = E[o + 4] - B[p + 4]; let m = 0;
        if(dx || dz) m |= dx >= -128 && dx <= 127 && dz >= -128 && dz <= 127 ? 1 : 2;
        if(E[o + 3] !== B[p + 3]) m |= 4; if(E[o + 5] !== B[p + 5]) m |= 8; if(E[o + 6] !== B[p + 6]) m |= 16; if(E[o + 7] !== B[p + 7]) m |= 32; if(E[o + 1] !== B[p + 1]) m |= 64;
        if(!m) continue; wVar(id - last); last = id; w8(m);
        if(m & 1){ w8(dx & 255); w8(dz & 255); } if(m & 2){ wi16(E[o + 2]); wi16(E[o + 4]); } if(m & 4) wi16(E[o + 3]); if(m & 8) w8(E[o + 5]); if(m & 16) w8(E[o + 6]); if(m & 32) w8(E[o + 7]); if(m & 64) w8(E[o + 1]); rec++; }
      else { wVar(id - last); last = id; w8(128); wFull(E, o); rec++; } } }
  _wb[cAt] = rec; _wb[cAt + 1] = gone; wEvents(f.ev, f.ne); return _wb.slice(0, _w); }
export function packInput(m){ _w = 0; w8(NET_MSG.INPUT); w8(NET_PROTO); w16(m.seq); w32(m.ackTick); w32(m.time); w16(m.ackEv); w16(m.evSeq); w8(m.ne); wPlayer(m.pl, 0); wEvents(m.ev, m.ne); return _wb.slice(0, _w); }
export function packPing(kind, timeMs){ _w = 0; w8(kind); w8(NET_PROTO); w32(timeMs >>> 0); return _wb.slice(0, _w); }
export function packPlayerState(s){ const P = new Int32Array(NET_PS); netPlayerQ(P, 0, s); _w = 0; wPlayer(P, 0); return _wb.slice(0, _w); }

// ---------- reading (every read is bounds-checked: bad bytes throw CoopProtocolError, they never crash a loop or read past the end) ----------
let _rb = _wb, _rv = _wv, _r = 0, _rn = 0;
function rOpen(bytes, off){ const u = bytes instanceof Uint8Array ? bytes : bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : null; if(!u) bad('TYPE', 'not bytes'); _rb = u; _rv = new DataView(u.buffer, u.byteOffset, u.byteLength); _r = off | 0; _rn = u.byteLength; }
function need(k){ if(_r + k > _rn) bad('TRUNCATED', 'needs ' + k + ' bytes at ' + _r + ' of ' + _rn); }
function r8(){ return _rb[_r++]; }
function ri8(){ const v = _rb[_r++]; return v > 127 ? v - 256 : v; }
function r16(){ const v = _rv.getUint16(_r, true); _r += 2; return v; }
function ri16(){ const v = _rv.getInt16(_r, true); _r += 2; return v; }
function r32(){ const v = _rv.getUint32(_r, true); _r += 4; return v; }
function rVar(){ let v = 0, sh = 0; for(let k = 0; k < 3; k++){ need(1); const b = _rb[_r++]; v |= (b & 127) << sh; if(b < 128) return v; sh += 7; } bad('VARINT', 'an id gap longer than 3 bytes'); }
function rId(last){ const id = last + rVar(); if(id <= last || id > 65535) bad('ORDER', 'ids must rise within 1–65535 (got ' + id + ' after ' + last + ')'); return id; }
function rHead(kind, min){ if(_rn - _r < min) bad('TRUNCATED', 'a message of ' + (_rn - _r) + ' bytes (needs ' + min + ')'); if(r8() !== kind) bad('KIND', 'not message kind ' + kind); const v = r8(); if(v !== NET_PROTO) bad('VERSION', 'peer speaks version ' + v + ', this page ' + NET_PROTO); }
function rPlayer(P, o){ need(NET_PLAYER_BYTES); P[o] = r8(); P[o + 1] = ri16(); P[o + 2] = ri16(); P[o + 3] = ri16(); P[o + 4] = r16(); P[o + 5] = r16(); P[o + 6] = ri16(); P[o + 7] = ri16(); P[o + 8] = ri16(); P[o + 9] = r8(); P[o + 10] = r8(); P[o + 11] = r8(); P[o + 12] = r16(); P[o + 13] = r16(); P[o + 14] = r16(); P[o + 15] = 0; }
function rEvents(V, n){ need(n * NET_EVENT_BYTES); for(let k = 0; k < n; k++){ const o = k * NET_VS; V[o] = r8(); V[o + 1] = r16(); V[o + 2] = r16(); V[o + 3] = ri16(); V[o + 4] = ri16(); V[o + 5] = ri16(); V[o + 6] = r16(); V[o + 7] = 0; } }
function rFull(E, o, id){ need(10); E[o] = id; E[o + 1] = r8(); E[o + 2] = ri16(); E[o + 4] = ri16(); E[o + 3] = ri16(); E[o + 5] = r8(); E[o + 6] = r8(); E[o + 7] = r8(); }
// the kind of a binary message (throws on an empty / foreign / other-version one)
export function netMsgKind(bytes){ rOpen(bytes, 0); if(_rn < 2) bad('TRUNCATED', 'a message of ' + _rn + ' bytes'); const k = _rb[0]; if(k < 1 || k > 4) bad('KIND', 'unknown message kind ' + k); if(_rb[1] !== NET_PROTO) bad('VERSION', 'peer speaks version ' + _rb[1] + ', this page ' + NET_PROTO); return k; }
const _gone = new Int32Array(LIM.entities);
// bytes → a frame. baseOf(tick) must return the frame of that tick (a delta needs it) or null; out = a frame to fill (never the base itself)
export function unpackSnapshot(bytes, baseOf, out){ rOpen(bytes, 0); rHead(NET_MSG.SNAP, 21); const f = out || makeNetFrame();
  f.tick = r32(); f.back = r8(); f.time = r32(); f.ackInput = r16(); f.ackEv = r16(); f.evSeq = r16(); const np = r8(), rec = r8(), gone = r8(), ne = r8(); f.n = 0; f.np = 0; f.ne = 0; f.over = 0;
  if(np > LIM.players || rec > LIM.entities || gone > LIM.entities || ne > LIM.events) bad('LIMIT', 'counts ' + np + ' / ' + rec + ' / ' + gone + ' / ' + ne + ' over the limits');
  if(f.back >= f.tick && f.back) bad('DELTA', 'base before the first snapshot');
  let base = null; if(f.back){ base = baseOf ? baseOf(f.tick - f.back) : null; if(!base) bad('NO_BASE', 'delta against snapshot ' + (f.tick - f.back) + ', which is not held'); if(base === f) bad('NO_BASE', 'the base is the frame being filled'); }
  else if(gone) bad('DELTA', 'a full snapshot lists nothing gone');
  for(let k = 0; k < np; k++) rPlayer(f.pl, k * NET_PS); f.np = np;
  const E = f.ent; let n = 0, last = 0;
  if(!base){ for(let k = 0; k < rec; k++){ last = rId(last); rFull(E, n * NET_ES, last); n++; } }
  else { const B = base.ent, bn = base.n; let j = 0, g = 0;
    for(let k = 0; k < gone; k++){ last = rId(last); _gone[k] = last; }
    last = 0;
    for(let k = 0; k <= rec; k++){ let id = 65536, m = 0; if(k < rec){ id = last = rId(last); need(1); m = r8(); }
      for(; j < bn && B[j * NET_ES] < id; j++){ const p = j * NET_ES, bid = B[p]; while(g < gone && _gone[g] < bid) g++; if(g < gone && _gone[g] === bid) continue;   // carried over unchanged, unless listed gone
        if(n >= LIM.entities) bad('LIMIT', 'more than ' + LIM.entities + ' entities'); const o = n * NET_ES; for(let q = 0; q < NET_ES; q++) E[o + q] = B[p + q]; n++; }
      if(k === rec) break; if(n >= LIM.entities) bad('LIMIT', 'more than ' + LIM.entities + ' entities'); const o = n * NET_ES, has = j < bn && B[j * NET_ES] === id;
      if(m & 128){ if(m !== 128) bad('DELTA', 'a new entity with other mask bits'); rFull(E, o, id); }
      else { if(!has) bad('DELTA', 'entity ' + id + ' changed but is not in the base'); if(!m || (m & 3) === 3) bad('DELTA', 'mask ' + m); const p = j * NET_ES; for(let q = 0; q < NET_ES; q++) E[o + q] = B[p + q];
        need(((m & 1) ? 2 : 0) + ((m & 2) ? 4 : 0) + ((m & 4) ? 2 : 0) + ((m & 8) ? 1 : 0) + ((m & 16) ? 1 : 0) + ((m & 32) ? 1 : 0) + ((m & 64) ? 1 : 0));
        if(m & 1){ E[o + 2] += ri8(); E[o + 4] += ri8(); } if(m & 2){ E[o + 2] = ri16(); E[o + 4] = ri16(); } if(m & 4) E[o + 3] = ri16(); if(m & 8) E[o + 5] = r8(); if(m & 16) E[o + 6] = r8(); if(m & 32) E[o + 7] = r8(); if(m & 64) E[o + 1] = r8(); }
      if(has) j++; n++; } }
  f.n = n; rEvents(f.ev, ne); f.ne = ne; if(_r !== _rn) bad('TRAILING', (_rn - _r) + ' bytes after the end'); return f; }
export function unpackInput(bytes, out){ rOpen(bytes, 0); rHead(NET_MSG.INPUT, 17 + NET_PLAYER_BYTES); const m = out || makeNetInput(); m.seq = r16(); m.ackTick = r32(); m.time = r32(); m.ackEv = r16(); m.evSeq = r16(); const ne = r8();
  if(ne > LIM.events) bad('LIMIT', ne + ' events'); rPlayer(m.pl, 0); rEvents(m.ev, ne); m.ne = ne; if(_r !== _rn) bad('TRAILING', (_rn - _r) + ' bytes after the end'); return m; }
export function unpackPing(bytes){ rOpen(bytes, 0); if(_rn !== 6) bad('TRUNCATED', 'a ping is 6 bytes'); const kind = r8(); if(kind !== NET_MSG.PING && kind !== NET_MSG.PONG) bad('KIND', 'not a ping'); if(r8() !== NET_PROTO) bad('VERSION', 'peer speaks another version'); return { kind, time:r32() }; }
export function unpackPlayerState(bytes, off, out){ rOpen(bytes, off || 0); const P = new Int32Array(NET_PS); rPlayer(P, 0); return netPlayerObj(P, 0, out); }

// ---------- the host's memory of what it sent (delta bases) and the guest's memory of what it got ----------
export function createSnapEncoder(){ const H = COOP.delta.history, ring = []; for(let k = 0; k < H; k++) ring.push({ tick:0, n:0, ent:new Int32Array(LIM.entities * NET_ES) }); let at = 0;
  const X = { fulls:0, deltas:0, bytes:0,
    // ackTick = the newest snapshot the peer says he holds (0 = none): a delta against it when it is remembered and near enough, else a full one
    encode(f, ackTick){ let base = null; ackTick = ackTick >>> 0;
      if(ackTick && f.tick > ackTick && f.tick - ackTick <= COOP.delta.maxBack) for(let k = 0; k < H; k++) if(ring[k].tick === ackTick){ base = ring[k]; break; }
      const out = packSnapshot(f, base), s = ring[at]; at = (at + 1) % H; s.tick = f.tick; s.n = f.n; s.ent.set(f.ent.subarray(0, f.n * NET_ES));
      if(base) X.deltas++; else X.fulls++; X.bytes += out.length; return out; },
    reset(){ for(const s of ring) s.tick = 0; } };
  return X; }
export function createSnapDecoder(){ const H = COOP.delta.history, ring = []; for(let k = 0; k < H; k++) ring.push(makeNetFrame()); let at = 0;
  const baseOf = t => { for(let k = 0; k < H; k++) if(ring[k].tick === t && k !== at) return ring[k]; return null; };
  const D = { newest:0, stale:0, errors:0, fulls:0, deltas:0,
    // → the decoded frame (good until `history` more arrive), or null for one older than what is already held; throws CoopProtocolError on bad bytes
    decode(bytes){ const slot = ring[at]; slot.tick = 0;
      try{ unpackSnapshot(bytes, baseOf, slot); }catch(e){ slot.tick = 0; D.errors++; throw e; }
      if(D.newest && slot.tick <= D.newest){ slot.tick = 0; D.stale++; return null; }
      D.newest = slot.tick; at = (at + 1) % H; if(slot.back) D.deltas++; else D.fulls++; return slot; },
    ackTick(){ return D.newest; },   // what to tell the host: the newest snapshot held (always a valid base for the next delta)
    reset(){ for(const s of ring) s.tick = 0; D.newest = 0; } };
  return D; }

// ---------- events that must arrive: numbered, sent again in every message until the other side says it has them ----------
export function createEventOutbox(){ const CAP = LIM.eventQueue, Qe = new Int32Array(CAP * NET_VS); let head = 0, count = 0, first = 1;   // first = seq of the oldest one kept
  const O = { lost:0, sent:0,
    get pending(){ return count; }, get nextSeq(){ return (first + count) & 0xffff; },
    push(type, a, b, x, y, z, p){ if(count === CAP){ head = (head + 1) % CAP; count--; first = (first + 1) & 0xffff; O.lost++; }   // (full: the oldest goes — it had hundreds of sends to get through)
      const o = ((head + count) % CAP) * NET_VS; Qe[o] = type & 255; Qe[o + 1] = a & 0xffff; Qe[o + 2] = b & 0xffff; Qe[o + 3] = netQPos(x); Qe[o + 4] = netQPos(y); Qe[o + 5] = netQPos(z); Qe[o + 6] = p & 0xffff; count++; O.sent++; return (first + count - 1) & 0xffff; },
    ack(seq){ while(count && !netSeqNewer(first, seq)){ head = (head + 1) % CAP; count--; first = (first + 1) & 0xffff; } },   // the peer has everything up to seq
    fill(m){ const n = Math.min(count, LIM.events); m.evSeq = first; m.ne = n; for(let k = 0; k < n; k++){ const o = ((head + k) % CAP) * NET_VS, t = k * NET_VS; for(let q = 0; q < 7; q++) m.ev[t + q] = Qe[o + q]; m.ev[t + 7] = 0; } return n; },
    reset(){ head = 0; count = 0; first = 1; } };
  return O; }
export function createEventInbox(){ const I = { last:0, got:0, missed:0,
    // hands each event not seen before to fn(type, a, b, x, y, z, p) (metres); → how many were new
    take(m, fn){ let n = 0; for(let k = 0; k < m.ne; k++){ const seq = (m.evSeq + k) & 0xffff; if(!netSeqNewer(seq, I.last)) continue; const gap = (seq - I.last - 1) & 0xffff; if(gap) I.missed += gap;
        I.last = seq; I.got++; n++; const o = k * NET_VS, V = m.ev; if(fn) fn(V[o], V[o + 1], V[o + 2], V[o + 3] / Q.pos, V[o + 4] / Q.pos, V[o + 5] / Q.pos, V[o + 6]); } return n; },
    reset(){ I.last = 0; } };
  return I; }

// ---------- the lobby (text): {"k":kind,"v":version,…} ----------
export function packControl(kind, body){ if(!NET_CTL.includes(kind)) throw new RangeError('coop: unknown control message ' + kind); return JSON.stringify(Object.assign({}, body, { k:kind, v:NET_PROTO })); }
export function parseControl(text){ if(typeof text !== 'string') bad('TYPE', 'a control message is text'); if(text.length > LIM.ctlBytes) bad('LIMIT', 'a control message of ' + text.length + ' characters');
  let m = null; try{ m = JSON.parse(text); }catch(e){ bad('JSON', 'not JSON'); }
  if(!m || typeof m !== 'object' || Array.isArray(m) || typeof m.k !== 'string') bad('JSON', 'no kind'); if(!NET_CTL.includes(m.k)) bad('KIND', 'unknown control message ' + m.k.slice(0, 24));
  if(m.v !== NET_PROTO) bad('VERSION', 'peer speaks version ' + m.v + ', this page ' + NET_PROTO); return m; }
// the battle both pages must build alike: a seed (1 – 2³²−1) and a flat bag of plain values (biome, stage, hour, weather, difficulty …); anything else is dropped
export function netCleanSettings(s){ const out = { seed:0, battle:{} }; if(!s || typeof s !== 'object') return out; const seed = Math.floor(+s.seed); out.seed = seed >= 1 && seed <= 0xffffffff ? seed : 0;
  if(s.battle && typeof s.battle === 'object'){ let n = 0; for(const k of Object.keys(s.battle)){ const v = s.battle[k]; if(n >= LIM.battleKeys) break; if(!/^[\w-]{1,24}$/.test(k)) continue;
      if(typeof v === 'string' ? v.length <= 48 : typeof v === 'boolean' || (typeof v === 'number' && v === v && Math.abs(v) < 1e15)){ out.battle[k] = v; n++; } } }
  return out; }
