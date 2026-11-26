#!/usr/bin/env node
// tools/coop-test.mjs — COOP 3 THE CO-OP NET LAYER TESTED WITHOUT A BROWSER: `npm run coop-test` (≈ 3 s, plain Node 22, no GPU, no page).
//   part 1 (no socket): the wire format round-trips, bad bytes throw CoopProtocolError, deltas heal under 20 % loss, events arrive once and in order
//   part 2 (a real tools/lan-room.mjs on 127.0.0.1, a free port; a fake host and a fake guest through net/transport.js):
//     join / ready handshake · room-full / no-such-room / bad-request · static files (and what must NOT be served) · 20 snapshots / s of 80 moving
//     entities for 10 simulated seconds relayed intact · the guest's inputs at the host · the guest's interpolation error for straight-line motion
//     under 5 cm at the configured delay · reconnect after the server drops both sockets · the room dropped once empty
//   and it REPORTS the measured bytes a second each way. Exit code 0 only when every check passed; it closes every server and socket it opened.
//   options: --seconds 10 (simulated battle length) · --json (one line of numbers at the end)
import { COOP } from '../config.js';
import * as P from '../src/net/protocol.js';
import { createSnapInterp, makeInterpOut } from '../src/net/interp.js';
import { createWsTransport, createLoopbackPair } from '../src/net/transport.js';
import { createCoopSession, coopStart, coopActive, coopIsHost, coopParseUrl, coopWsUrl, coopBroadcast, coopSendInput, coopState } from '../src/net/coop.js';
import { startLanRoom } from './lan-room.mjs';
import net from 'node:net'; import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SECONDS = +opt('--seconds', 10), ES = P.NET_ES;
let pass = 0, fail = 0; const report = {};
const ok = (c, msg) => { if(c) pass++; else { fail++; console.log('  ✗ ' + msg); } };
const say = (c, msg) => { ok(c, msg); if(c) console.log('  ✓ ' + msg); };   // a check whose message carries a measured number: shown when it passes too
const grp = t => console.log('• ' + t);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms, what){ const t0 = Date.now(); while(!fn()){ if(Date.now() - t0 > ms) throw new Error('timed out waiting for ' + what); await new Promise(r => setImmediate(r)); } }
function rng32(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const throwsCode = (fn, code) => { try{ fn(); }catch(e){ return e instanceof P.CoopProtocolError && (!code || e.code === code); } return false; };
const sameEnt = (a, b) => { if(a.n !== b.n) return false; for(let i = 0; i < a.n * ES; i++) if(a.ent[i] !== b.ent[i]) return false; return true; };
const keep = f => ({ tick:f.tick, n:f.n, ent:f.ent.slice(0, f.n * ES) });
const angErr = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// ---------- the test world: 80 things that all move (the worst case for the wire) ----------
// 60 men walking straight (1–6 m/s, on the ground: y = 0, the guest reads the height off its own identical land), 12 circling, 6 helicopters (fast, high,
// bobbing), 2 that stand still; every 2 s one man goes and a new one comes. pos(t) is exact, so the guest's drawn position can be judged against it.
function makeWorld(seed){ const R = rng32(seed), ents = []; let nextId = COOP.ids.firstEntity;
  const man = born => { const a = R() * 6.283, v = 1 + R() * 5; return { id:nextId++, kind:1 + (R() * 4 | 0), type:'line', x0:(R() - 0.5) * 200, z0:(R() - 0.5) * 200, vx:Math.cos(a) * v, vz:Math.sin(a) * v, y:0, born, hp:1, fire:R() * 3 }; };
  for(let i = 0; i < 60; i++) ents.push(man(0));
  for(let i = 0; i < 12; i++){ const r = 8 + R() * 12; ents.push({ id:nextId++, kind:6, type:'circle', cx:(R() - 0.5) * 240, cz:(R() - 0.5) * 240, r, w:(R() < 0.5 ? -1 : 1) * 4 / r, ph:R() * 6.283, y:0, born:0, hp:1, fire:9 }); }
  for(let i = 0; i < 6; i++){ const a = R() * 6.283, v = 13 + R() * 5; ents.push({ id:nextId++, kind:9, type:'heli', x0:(R() - 0.5) * 100, z0:(R() - 0.5) * 100, vx:Math.cos(a) * v, vz:Math.sin(a) * v, y:22, born:0, hp:1, fire:9, ph:R() * 6 }); }
  for(let i = 0; i < 2; i++) ents.push({ id:nextId++, kind:12, type:'still', x0:(R() - 0.5) * 300, z0:(R() - 0.5) * 300, vx:0, vz:0, y:0, born:0, hp:1, fire:9 });
  const W = { ents, swaps:0,
    pos(e, t, out){ const s = (t - e.born) / 1000; if(e.type === 'circle'){ const a = e.ph + e.w * s; out.x = e.cx + Math.cos(a) * e.r; out.z = e.cz + Math.sin(a) * e.r; out.y = 0; out.h = a + (e.w > 0 ? 1 : -1) * Math.PI / 2; }
      else { out.x = e.x0 + e.vx * s; out.z = e.z0 + e.vz * s; out.y = e.type === 'heli' ? e.y + Math.sin(e.ph + s * 1.7) * 0.5 : e.y; out.h = Math.atan2(e.vz, e.vx); } return out; },
    byId(id){ return ents.find(e => e.id === id); },
    step(t){ const k = Math.floor(t / 2000); if(k > W.swaps){ W.swaps = k; const i = ents.findIndex(e => e.type === 'line'); const dead = ents[i]; ents.splice(i, 1); const m = man(t); ents.push(m); return { dead, born:m }; } return null; },
    fill(f, t){ const p = {}; for(const e of ents){ W.pos(e, t, p); const firing = ((t / 1000 + e.fire) % 3) < 0.6 ? P.NET_ESTATE.FIRING : 0, hp = e.type === 'line' ? Math.max(0.1, 1 - Math.floor((t - e.born) / 2500) * 0.15) : 1;
        P.netFrameAdd(f, e.id, e.kind, p.x, p.y, p.z, p.h, (e.type === 'still' ? P.NET_POSE.CROUCH : P.NET_POSE.RUN) | firing, hp); } } };
  return W; }
const hostMan = t => ({ id:COOP.ids.host, x:10 + t * 0.004, y:0, z:-20 + t * 0.002, heading:0.4, aimYaw:0.5 + Math.sin(t / 700) * 0.6, aimPitch:-0.1, vx:4, vz:2, stance:P.NET_STANCE.STAND, weapon:3, flags:P.NET_PFLAG.FIRING, hp:86, hpMax:100, mount:0 });
const guestMan = t => ({ id:COOP.ids.guest, x:-30 + t * 0.003, y:1.25, z:44 - t * 0.0035, heading:5.9, aimYaw:6.1 + Math.sin(t / 500) * 0.4, aimPitch:0.2, vx:3, vz:-3.5, stance:P.NET_STANCE.CROUCH, weapon:7, flags:P.NET_PFLAG.RELOADING | P.NET_PFLAG.AIMING, hp:64, hpMax:100, mount:0 });

// =====================================================================================================================
grp('asleep unless asked: importing the layer starts nothing, no ?room= → nothing');
{ const h0 = process._getActiveHandles().length;
  ok(coopStart({ search:'' }) === null && coopStart({ search:'?test=DESERT&seed=7' }) === null && coopStart({ search:'?coop=host' }) === null, 'coopStart without ?room= returns null');
  ok(coopActive() === false && coopIsHost() === false && coopState() === 'idle' && coopBroadcast(P.makeNetFrame()) === 0 && coopSendInput(guestMan(0)) === 0, 'the hooks answer "no co-op" (false / 0) when no session exists');
  ok(process._getActiveHandles().length === h0, 'no timer, no socket was left by that');
  const q = coopParseUrl('?seed=3&room=k7m2q&coop=host&name=An'); ok(q && q.room === 'K7M2Q' && q.host === true && q.seed === 3 && q.name === 'An' && coopParseUrl('?room=K7M2Q').seed === 0 && coopParseUrl('?room=K7M2Q').host === false && coopParseUrl('?room=a b') === null, 'coopParseUrl');
  ok(coopWsUrl({ protocol:'http:', host:'192.168.1.5:8777' }, 'K7M2Q', 'guest', 'Bình') === 'ws://192.168.1.5:8777/ws?room=K7M2Q&role=guest&name=B%C3%ACnh', 'coopWsUrl'); }

grp('protocol: a player state, a full snapshot, a chain of deltas — all round-trip');
{ const s = guestMan(1234), b = P.packPlayerState(s), u = P.unpackPlayerState(b);
  ok(b.length === P.NET_PLAYER_BYTES && u.id === s.id && Math.abs(u.x - s.x) <= 0.005 && Math.abs(u.y - s.y) <= 0.005 && Math.abs(u.z - s.z) <= 0.005 && angErr(u.heading, s.heading) < 1e-4 && angErr(u.aimYaw, s.aimYaw) < 1e-4 && Math.abs(u.aimPitch - s.aimPitch) < 1e-4
    && u.stance === s.stance && u.weapon === s.weapon && u.flags === s.flags && u.hp === 64 && u.hpMax === 100 && Math.abs(u.vx - 3) < 0.006 && Math.abs(u.vz + 3.5) < 0.006, 'player state: 26 bytes, back within a centimetre / a 16-bit angle');
  const W = makeWorld(7), enc = P.createSnapEncoder(), dec = P.createSnapDecoder(), f = P.makeNetFrame(); let fullB = 0, deltaB = 0, bad = 0, n = 0;
  for(let k = 1; k <= 120; k++){ const t = k * 50; W.step(t); P.netFrameReset(f, k, t); f.ackInput = k & 0xffff; f.ackEv = 9; f.evSeq = 3; W.fill(f, t); P.netFramePlayer(f, hostMan(t)); P.netFramePlayer(f, guestMan(t)); P.netFrameEvent(f, P.NET_EV.SHOT, 20, 31, 1.5, 2, -3.25, 7);
    const bytes = enc.encode(f, dec.ackTick()), g = dec.decode(bytes); if(k === 1) fullB = bytes.length; else { deltaB += bytes.length; n++; }
    if(!g || !sameEnt(f, g) || g.tick !== k || g.time !== t || g.np !== 2 || g.ne !== 1 || g.ackInput !== (k & 0xffff) || g.ackEv !== 9 || g.evSeq !== 3 || g.back !== (k === 1 ? 0 : 1)) bad++;
    for(let i = 0; i < 2 * P.NET_PS; i++) if(g.pl[i] !== f.pl[i]) bad++; for(let i = 0; i < 7; i++) if(g.ev[i] !== f.ev[i]) bad++; }
  ok(bad === 0 && enc.fulls === 1 && enc.deltas === 119 && dec.fulls === 1 && dec.deltas === 119, '120 snapshots of 80 entities: 1 full + 119 deltas, every one decoded equal to what was packed');
  say(fullB === 21 + 52 + 80 * 11 + 13 && deltaB / n < fullB * 0.6, `a full snapshot is ${fullB} B, a delta ${Math.round(deltaB / n)} B on average`); report.fullBytes = fullB; report.deltaBytes = Math.round(deltaB / n);
  const e0 = P.netFrameEnt(f, 0), w0 = W.pos(W.byId(e0.id), 6000, {}); ok(Math.abs(e0.x - w0.x) <= 0.00501 && Math.abs(e0.z - w0.z) <= 0.00501 && Math.abs(Math.atan2(Math.sin(e0.heading - w0.h), Math.cos(e0.heading - w0.h))) <= Math.PI / 256 + 1e-9, 'an entity comes back within half a centimetre and half a heading step (0.7°)');
  // order, cap, range
  const g = P.makeNetFrame(); P.netFrameReset(g, 1, 0); for(const id of [40, 20, 30, 20, 25]) P.netFrameAdd(g, id, 1, id, 0, 0, 0, 0, 1); ok(g.n === 4 && [0, 1, 2, 3].map(i => g.ent[i * ES]).join() === '20,25,30,40' && P.netFrameFind(g, 30) === 2 && P.netFrameFind(g, 31) === -1, 'a frame keeps its entities sorted by id; the same id overwrites');
  P.netFrameReset(g, 1, 0); let added = 0; for(let id = 1; id <= 130; id++) if(P.netFrameAdd(g, id, 1, 0, 0, 0, 0, 0, 1)) added++; ok(added === COOP.limits.entities && g.over === 10, 'over ' + COOP.limits.entities + ' entities the rest are left out and counted, nothing throws');
  let rangeErr = false; try{ P.netFrameAdd(g, 0, 1, 0, 0, 0, 0, 0, 1); }catch(e){ rangeErr = e instanceof RangeError; } ok(rangeErr && P.netQPos(1e9) === 32767 && P.netQPos(-1e9) === -32767 && P.netQPos(NaN) === 0 && P.netQHp(0.0001) === 1 && P.netQHp(0) === 0 && P.netQAng(-0.001, 256) === 0 && P.netQAng(6.2831, 256) === 0, 'ids 1–65535 only; positions clamp to the int16 field, NaN → 0, a living thing never reads 0 hp, angles wrap'); }

grp('protocol: bad bytes throw a clear error — truncated, foreign, other version, garbage — and never anything else');
{ const W = makeWorld(3), enc = P.createSnapEncoder(), f = P.makeNetFrame(); P.netFrameReset(f, 1, 50); W.fill(f, 50); P.netFramePlayer(f, hostMan(50)); const full = enc.encode(f, 0);
  P.netFrameReset(f, 2, 100); W.fill(f, 100); const delta = enc.encode(f, 1), base = P.unpackSnapshot(full, null), baseOf = t => t === 1 ? base : null;
  ok(throwsCode(() => P.unpackSnapshot(new Uint8Array(0)), 'TRUNCATED') && throwsCode(() => P.unpackSnapshot(full.slice(0, 20)), 'TRUNCATED') && throwsCode(() => P.unpackSnapshot(full.slice(0, full.length - 3)), 'TRUNCATED'), 'truncated → TRUNCATED');
  const v2 = full.slice(); v2[1] = 99; const k9 = full.slice(); k9[0] = 9; const extra = new Uint8Array(full.length + 2); extra.set(full);
  ok(throwsCode(() => P.unpackSnapshot(v2), 'VERSION') && throwsCode(() => P.netMsgKind(v2), 'VERSION') && throwsCode(() => P.unpackSnapshot(k9), 'KIND') && throwsCode(() => P.netMsgKind(k9), 'KIND') && throwsCode(() => P.unpackSnapshot(extra), 'TRAILING'), 'other version → VERSION, other kind → KIND, bytes after the end → TRAILING');
  ok(throwsCode(() => P.unpackSnapshot(delta, null), 'NO_BASE') && throwsCode(() => P.unpackSnapshot(delta, () => null), 'NO_BASE') && P.unpackSnapshot(delta, baseOf).n === 80 && throwsCode(() => P.unpackSnapshot('hello'), 'TYPE'), 'a delta without its base → NO_BASE; text → TYPE');
  const big = full.slice(); big[18] = 200; ok(throwsCode(() => P.unpackSnapshot(big), 'LIMIT'), 'more records than the limit → LIMIT');
  const R = rng32(99); let other = 0, thrown = 0, passed = 0;
  for(let k = 0; k < 6000; k++){ const src = k % 3 === 0 ? delta : full, b = src.slice(0, k % 7 === 0 ? 1 + (R() * src.length | 0) : src.length); const flips = 1 + (R() * 4 | 0); for(let j = 0; j < flips; j++) b[R() * b.length | 0] = R() * 256 | 0;
    try{ P.unpackSnapshot(b, baseOf); passed++; }catch(e){ if(e instanceof P.CoopProtocolError) thrown++; else other++; } }
  for(let k = 0; k < 3000; k++){ const b = new Uint8Array(R() * 80 | 0); for(let j = 0; j < b.length; j++) b[j] = R() * 256 | 0; if(b.length > 1 && k % 2){ b[0] = 1 + (k % 4); b[1] = P.NET_PROTO; }
    for(const fn of [() => P.unpackSnapshot(b, baseOf), () => P.unpackInput(b), () => P.unpackPing(b), () => P.netMsgKind(b), () => P.unpackPlayerState(b)]){ try{ fn(); passed++; }catch(e){ if(e instanceof P.CoopProtocolError) thrown++; else other++; } } }
  say(other === 0 && thrown > 5000, `fuzz: ${thrown} corrupted messages refused with CoopProtocolError, ${passed} still well-formed, ${other} other exceptions`); report.fuzz = { refused:thrown, wellFormed:passed, crashed:other };
  ok(throwsCode(() => P.parseControl('{nope'), 'JSON') && throwsCode(() => P.parseControl('[1]'), 'JSON') && throwsCode(() => P.parseControl('{"k":"format-disk","v":1}'), 'KIND') && throwsCode(() => P.parseControl(JSON.stringify({ k:'hello', v:P.NET_PROTO + 1 })), 'VERSION')
    && throwsCode(() => P.parseControl('{"k":"hello","v":1,"x":"' + 'a'.repeat(5000) + '"}'), 'LIMIT') && P.parseControl(P.packControl('ready', { on:true, rev:2 })).on === true, 'lobby JSON: not JSON / unknown kind / other version / too long are refused');
  const c = P.netCleanSettings({ seed:'77', battle:{ biome:'DESERT', level:3, night:false, bad:{ a:1 }, 'x y':1, fn:() => 1, long:'z'.repeat(99) } }); ok(c.seed === 77 && JSON.stringify(c.battle) === '{"biome":"DESERT","level":3,"night":false}' && P.netCleanSettings({ seed:-1 }).seed === 0 && P.netCleanSettings(null).seed === 0, 'battle settings: a seed and plain values only'); }

grp('events: numbered, resent until acknowledged, delivered once and in order');
{ const ob = P.createEventOutbox(), ib = P.createEventInbox(), m = P.makeNetInput(), got = [], R = rng32(5); let pushed = 0;
  for(let round = 0; round < 3000; round++){ const k = R() * 4 | 0; for(let j = 0; j < k; j++){ pushed++; ob.push(P.NET_EV.HIT, pushed & 0xffff, (pushed >> 16) & 0xffff, pushed % 300 - 150, 1, 2, 3); }
    ob.fill(m); if(R() < 0.6) ib.take(m, (t, a, b, x) => got.push([a | b << 16, x])); if(R() < 0.6) ob.ack(ib.last); }
  for(let k = 0; k < 20; k++){ ob.fill(m); ib.take(m, (t, a, b, x) => got.push([a | b << 16, x])); ob.ack(ib.last); }
  say(pushed > 4000 && got.length === pushed && got.every((g, i) => g[0] === i + 1 && g[1] === (i + 1) % 300 - 150) && ob.pending === 0 && ob.lost === 0 && ib.missed === 0, `${pushed} events through a 40 %-loss channel both ways: each arrived once, in order (the 16-bit counter wrapped ${pushed > 65535 ? '' : 'not '}yet)`);
  const ob2 = P.createEventOutbox(), ib2 = P.createEventInbox(); let n2 = 0, bad2 = 0; for(let i = 1; i <= 70000; i++){ ob2.push(1, i & 0xffff, 0, 0, 0, 0, 0); ob2.fill(m); ib2.take(m, (t, a) => { n2++; if(a !== (n2 & 0xffff)) bad2++; }); ob2.ack(ib2.last); }
  ok(n2 === 70000 && bad2 === 0 && P.netSeqNewer(2, 65534) && !P.netSeqNewer(65534, 2) && !P.netSeqNewer(5, 5), '70 000 events: the sequence number wraps past 65 535 without a hiccup'); }

grp('interpolation: straight-line motion drawn exactly, in spite of jitter and lost snapshots');
{ const W = makeWorld(11), R = rng32(21), I = createSnapInterp(), f = P.makeNetFrame(), out = makeInterpOut(), p = {}, SKEW = 5e6, arrivals = [], graves = new Map(); let maxLin = 0, maxCirc = 0, lerp = 0, other = 0, born = 0, gone = 0;
  for(let k = 1; k <= 200; k++) if(R() > 0.1 || k < 3) arrivals.push([k * 50 + R() * 30, k]);   // 10 % lost, 0–30 ms late
  arrivals.sort((a, b) => a[0] - b[0]); let ai = 0;
  for(let t = 0; t <= 10000; t += 1000 / 60){ while(ai < arrivals.length && arrivals[ai][0] <= t){ const k = arrivals[ai++][1]; W2step(k * 50); P.netFrameReset(f, k, k * 50); W.fill(f, k * 50); I.push(f, arrivals[ai - 1][0] + SKEW); }
    I.sample(t + SKEW, out); born += out.nBorn; gone += out.nGone; if(out.mode !== 'lerp'){ other++; continue; } lerp++;
    for(let i = 0; i < out.n; i++){ const e = W.byId(out.id[i]); if(!e) continue;   // (gone in the next snapshot: held where he was last seen, not judged)
      W.pos(e, out.t, p); const d = Math.hypot(out.x[i] - p.x, out.z[i] - p.z, out.y[i] - p.y); if(e.type === 'circle') maxCirc = Math.max(maxCirc, d); else if(e.type !== 'heli') maxLin = Math.max(maxLin, d); } }
  function W2step(t){ const s = W.step(t); if(s) graves.set(s.dead.id, s.dead); }
  say(lerp > 500 && maxLin < 0.05, `straight-line error ${(maxLin * 100).toFixed(2)} cm over ${lerp} drawn frames (limit 5 cm) with 10 % of snapshots lost and 0–30 ms of jitter; ${other} frames outside two snapshots`);
  say(maxCirc < 0.25 && born >= 80 && gone >= 4 && Math.abs(I.offset + SKEW) < 31, `a man circling at 4 m/s is within ${(maxCirc * 100).toFixed(1)} cm (chord error across a lost snapshot); ${born} appeared, ${gone} went; the clock offset was found to ${Math.abs(I.offset + SKEW).toFixed(1)} ms`); report.interpPure = { linearCm:+(maxLin * 100).toFixed(2), circleCm:+(maxCirc * 100).toFixed(1) };
  // headings go the short way round; a coast is capped; a jump is not walked
  const J = createSnapInterp({ delayMs:0 }), a = P.makeNetFrame(); P.netFrameReset(a, 1, 1000); P.netFrameAdd(a, 20, 1, 0, 0, 0, 6.2, 0, 1); P.netFrameAdd(a, 21, 1, 0, 0, 0, 0, 0, 1); J.push(a, 1000);
  P.netFrameReset(a, 2, 1100); P.netFrameAdd(a, 20, 1, 1, 0, 0, 0.1, 0, 1); P.netFrameAdd(a, 21, 1, 50, 0, 0, 0, 0, 1); P.netFrameAdd(a, 22, 1, 5, 0, 5, 0, 0, 1); J.push(a, 1100);
  let o = J.sample(1050); const hd = Math.atan2(Math.sin(o.heading[0] - 6.2), Math.cos(o.heading[0] - 6.2));
  ok(o.mode === 'lerp' && o.n === 2 && Math.abs(o.x[0] - 0.5) < 0.006 && hd > 0.05 && hd < 0.13 && o.x[1] === 0, 'between two snapshots: halfway, the heading through 0 (6.2 → 0.1 rad the short way), a 50 m jump not walked, the new arrival not there yet');
  o = J.sample(1100); const at1100 = o.n; o = J.sample(1100 + 60); const x60 = o.x[0]; o = J.sample(1100 + 5000);
  ok(at1100 === 3 && o.mode === 'coast' && Math.abs(x60 - 1.6) < 0.01 && Math.abs(o.x[0] - (1 + COOP.interp.extrapMs / 100)) < 0.01 && o.x[1] === 50, 'past the newest snapshot it coasts along the last step, for ' + COOP.interp.extrapMs + ' ms at most');
  ok(J.push(a, 1200) === false && J.dropped === 1 && createSnapInterp().sample(5).mode === 'empty', 'an out-of-order snapshot is dropped; an empty buffer draws nothing'); }

grp('a session over a lossy in-memory line: the lobby, deltas that heal themselves, events once each');
{ const clock = { t:1000 }, [ta, tb] = createLoopbackPair({ loss:0.2, rng:rng32(77), hostName:'An', guestName:'Bình' });
  const H = createCoopSession({ role:'host', room:'LOOP', name:'An', transport:ta, now:() => clock.t, timers:false }), G = createCoopSession({ role:'guest', room:'LOOP', name:'Bình', transport:tb, now:() => clock.t + 777777, timers:false });
  const hs = [], gs = []; H.on('state', s => hs.push(s)); G.on('state', s => gs.push(s)); let gotSeed = 0; G.on('settings', seed => { gotSeed = seed; });
  H.start(); ok(H.state === 'lobby' && !H.peer && H.begin() === false, 'the host alone sits in the lobby and cannot begin');
  G.start(); ok(G.state === 'lobby' && H.peer && G.peer && H.peerName === 'Bình' && G.peerName === 'An', 'the guest joins: each knows the other by name');
  G.setReady(true); H.setReady(true); ok(H.state === 'lobby' && G.state === 'lobby', 'ready without a battle agreed is not enough');
  ok(H.setSettings({ seed:0 }) === false && G.setSettings({ seed:5 }) === false && H.setSettings({ seed:4242, battle:{ biome:'DESERT', level:3, tod:'noon' } }) === true && gotSeed === 4242 && G.battle.biome === 'DESERT' && G.ready === false && H.state === 'lobby', 'the host sets the seed and the battle; new settings ask the guest to say ready again');
  G.setReady(true); ok(H.state === 'ready' && G.state === 'ready' && G.begin() === false, 'both ready → ready; only the host may begin');
  G.setReady(false); ok(H.state === 'lobby' && G.state === 'lobby', 'one of them steps back → lobby'); G.setReady(true);
  ok(H.begin() === true && H.state === 'playing' && G.state === 'playing' && G.seed === 4242 && hs.join() === 'connecting,lobby,ready,lobby,ready,playing' && gs.join() === hs.join(), 'begin → both playing on the same seed (' + hs.join(' → ') + ')');
  const fld = []; G.on('field', (same, mine, theirs) => fld.push([same, mine, theirs])); let hh = P.NET_HASH0, hg = P.NET_HASH0; for(let i = 0; i < 500; i++){ hh = P.netHashStep(hh, i * 37 - 4000); hg = P.netHashStep(hg, i === 499 ? 1 : i * 37 - 4000); }
  H.setFieldHash(hh, 'stage 1'); G.setFieldHash(hg, 'stage 1'); const miss = fld.length === 1 && fld[0][0] === false && G.fieldOk === false && H.fieldOk === false; G.setFieldHash(hh, 'stage 1'); H.setFieldHash(hh + 5, 'stage 2');
  ok(miss && hh !== hg && hh !== P.NET_HASH0 && fld.length === 2 && fld[1][0] === true && G.fieldOk === true && H.fieldOk === true, 'each page reports the fingerprint of the battlefield it built: one number off → "not the same field"; equal → fine; another stage\'s is not compared with this one\'s');
  const W = makeWorld(31), truth = new Map(), hEv = [], gEv = []; let badSnap = 0, snaps = 0, inputs = 0, lastIn = null, hPushed = 0, gPushed = 0;
  G.on('snapshot', f => { snaps++; const w = truth.get(f.tick); if(!w || !sameEnt(w, f)) badSnap++; }); G.on('event', (t, a, b) => gEv.push(a | b << 16)); H.on('event', (t, a, b) => hEv.push(a | b << 16)); H.on('input', st => { inputs++; lastIn = Object.assign({}, st); });
  for(let k = 1; k <= 460; k++){ clock.t += 50; const t = clock.t; if(k <= 400){ W.step(t); H.sendEvent(P.NET_EV.SHOT, ++hPushed & 0xffff, hPushed >> 16, 1, 2, 3, 4); if(k % 2) G.sendEvent(P.NET_EV.HIT, ++gPushed & 0xffff, gPushed >> 16, 1, 2, 3, 4); }
    const f = H.frame(); W.fill(f, t); P.netFramePlayer(f, hostMan(t)); P.netFramePlayer(f, guestMan(t)); truth.set(H.tick + 1, keep(f)); H.broadcast(f); /* (this line delivers inside broadcast: the truth is filed first) */ G.sendInput(guestMan(t)); if(k % 3 === 0) G.sendInput(guestMan(t)); H.step(t); G.step(t + 777777); }
  say(snaps > 300 && snaps < 420 && badSnap === 0 && G.stats.errors === 0 && H.stats.errors === 0 && H.encoder.fulls <= 3 && G.decoder.stale === 0, `20 % of everything lost: ${snaps} of 460 snapshots arrived, every one equal to the host's world, ${H.encoder.fulls} full + ${H.encoder.deltas} deltas, no decode error`);
  say(gEv.length === hPushed && gEv.every((v, i) => v === i + 1) && hEv.length === gPushed && hEv.every((v, i) => v === i + 1), `${hPushed} host events and ${gPushed} guest events each arrived exactly once, in order`);
  const gm = guestMan(clock.t), hv = H.sample(clock.t + 500); say(inputs > 400 && lastIn && lastIn.id === COOP.ids.guest && Math.abs(lastIn.x - gm.x) < 0.5 && lastIn.weapon === 7 && lastIn.flags === gm.flags && hv.np === 1 && Math.abs(hv.pl[0].z - gm.z) < 0.8, `the guest's soldier reaches the host (${inputs} inputs) and is drawn there from the same buffer`);
  const o = G.sample(clock.t + 777777); ok(o.np === 2 && o.n === 80 && (o.mode === 'lerp' || o.mode === 'coast') && o.pl[0].id === COOP.ids.host && o.pl[0].hpMax === 100, 'the guest draws 80 entities and both soldiers');
  // garbage and another version
  tb.subs.emit('message', new Uint8Array([1, P.NET_PROTO, 9, 9, 9]), true); tb.subs.emit('message', '{"k":"hello"', false); tb.subs.emit('message', new Uint8Array(0), true);
  ok(G.stats.errors === 3 && G.state === 'playing' && /TRUNCATED|JSON/.test(G.stats.lastError), 'garbage from the line is counted and dropped — the session goes on');
  G.stop('left'); ok(G.state === 'ended' && H.state === 'ended' && H.reason === 'left' && ta.state === 'closed' && tb.state === 'closed', 'one leaves → both ended, both lines closed');
  const [tc, td] = createLoopbackPair(), H2 = createCoopSession({ role:'host', transport:tc, timers:false }), G2 = createCoopSession({ role:'guest', transport:td, timers:false }); H2.start(); G2.start();
  td.subs.emit('message', JSON.stringify({ k:'hello', v:P.NET_PROTO + 1, sid:'x', role:'host' }), false); ok(G2.state === 'ended' && G2.reason === 'version' && H2.state === 'ended', 'a peer on another protocol version ends the session with reason "version"');
  const [te, tf] = createLoopbackPair(), H3 = createCoopSession({ role:'host', transport:te, timers:false }), H4 = createCoopSession({ role:'host', transport:tf, timers:false }); H3.start(); H4.start(); ok(H3.state === 'ended' && H3.reason === 'same-role' || H4.reason === 'same-role', 'two hosts → "same-role"'); H3.stop(); H4.stop(); }

// =====================================================================================================================
// part 2 — real sockets on this machine only
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const room = await startLanRoom({ port:0, host:'127.0.0.1', quiet:true, graceMs:300, heartbeatMs:400, root:ROOT }), HTTP = 'http://127.0.0.1:' + room.port;
const wsUrl = (code, role, name) => `ws://127.0.0.1:${room.port}/ws?room=${code}&role=${role}&name=${encodeURIComponent(name || '')}`, LINK = { retryBaseMs:40, retryMaxMs:150, pingMs:60 };
const opened = [];   // every transport made below, closed at the end whatever happened
const wsT = (code, role, name) => { const t = createWsTransport(wsUrl(code, role, name), { link:LINK }); opened.push(t); return t; };
// a bare TCP client that speaks just enough WebSocket to misbehave on purpose
function rawClient(pathq, { pong = true } = {}){ return new Promise((done, no) => { const s = net.connect(room.port, '127.0.0.1'), key = crypto.randomBytes(16).toString('base64'); let buf = Buffer.alloc(0), up = false;
    const c = { s, key, head:'', frames:[], closed:false, texts(){ return c.frames.filter(f => f.op === 1).map(f => f.data.toString()); },
      send(op, payload, o){ o = Object.assign({ fin:true, mask:true }, o); const p = Buffer.from(payload), n = p.length, h = [(o.fin ? 0x80 : 0) | op]; if(n < 126) h.push((o.mask ? 0x80 : 0) | n); else if(n < 65536) h.push((o.mask ? 0x80 : 0) | 126, n >> 8, n & 255); else h.push((o.mask ? 0x80 : 0) | 127, 0, 0, 0, 0, n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255);
        if(!o.mask) return s.write(Buffer.concat([Buffer.from(h), p])); const m = crypto.randomBytes(4), q = Buffer.from(p); for(let i = 0; i < n; i++) q[i] ^= m[i & 3]; s.write(Buffer.concat([Buffer.from(h), m, q])); } };
    s.on('connect', () => s.write(`GET ${pathq} HTTP/1.1\r\nHost: 127.0.0.1:${room.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
    s.on('data', d => { buf = Buffer.concat([buf, d]); if(!up){ const i = buf.indexOf('\r\n\r\n'); if(i < 0) return; c.head = buf.subarray(0, i).toString(); buf = buf.subarray(i + 4); up = true; done(c); }
      while(buf.length >= 2){ let n = buf[1] & 127, o = 2; if(n === 126){ if(buf.length < 4) break; n = buf.readUInt16BE(2); o = 4; } else if(n === 127){ if(buf.length < 10) break; n = buf.readUInt32BE(6); o = 10; } if(buf.length < o + n) break;
        const f = { op:buf[0] & 15, fin:!!(buf[0] & 0x80), masked:!!(buf[1] & 0x80), data:Buffer.from(buf.subarray(o, o + n)) }; buf = buf.subarray(o + n); c.frames.push(f); if(f.op === 9 && pong) c.send(10, f.data); } });
    s.on('close', () => { c.closed = true; if(!up) done(c); }); s.on('error', () => {}); setTimeout(() => no(new Error('raw client: no answer')), 3000).unref(); }); }
const raws = [];
try{
  grp('the LAN room serves the game — and nothing it should not');
  { const r1 = await fetch(HTTP + '/package.json'), r2 = await fetch(HTTP + '/'), r3 = await fetch(HTTP + '/src/net/coop.js');
    ok(r1.status === 200 && r1.headers.get('cache-control') === 'no-store' && /steel-siege/.test(await r1.text()) && r2.status === 200 && /text\/html/.test(r2.headers.get('content-type')) && (await r2.text()).includes('<html') && r3.status === 200 && /javascript/.test(r3.headers.get('content-type')) && (await r3.text()).startsWith('// net/coop.js'), 'code and the page: 200, right type, never cached');
    let asset = ''; try{ const walk = d => { for(const f of fs.readdirSync(d)){ if(asset) return; const p = path.join(d, f); if(f.startsWith('.')) continue; if(fs.statSync(p).isDirectory()) walk(p); else if(/^[\w.-]+$/.test(f)) asset = path.relative(ROOT, p); } }; walk(path.join(ROOT, 'assets')); }catch(e){}
    if(asset){ const r = await fetch(HTTP + '/' + asset.split(path.sep).join('/'), { method:'HEAD' }); ok(r.status === 200 && r.headers.get('cache-control') === 'max-age=86400', 'an asset is cached for a day (' + asset + ')'); }
    const rawGet = u => new Promise(res => { const c = net.connect(room.port, '127.0.0.1', () => c.write(`GET ${u} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`)); let d = ''; c.on('data', x => d += x); c.on('close', () => res(+d.slice(9, 12))); c.on('error', () => res(0)); });   // (fetch would tidy the path first)
    const codes = []; for(const u of ['/.gitignore', '/.git/HEAD', '/node_modules/acorn/package.json', '/..%2f..%2f..%2fetc%2fpasswd', '/src/%2e%2e/%2e%2e/package.json', '/src/../../../etc/passwd', '/%00', '/nope.js', '/src/']) codes.push(await rawGet(u));
    const post = await fetch(HTTP + '/package.json', { method:'POST', body:'x' }), info = await (await fetch(HTTP + '/lan-room/info')).json();
    ok(codes.join() === '403,403,403,403,403,403,403,404,404' && post.status === 405 && info.ok && info.port === room.port && info.code === room.code && /^[A-HJKMNP-Z2-9]{5}$/.test(room.code) && Array.isArray(info.ips), 'dot-files, node_modules and paths that climb out: 403; missing: 404; POST: 405; /lan-room/info answers (room code ' + room.code + ')');
    const u = room.urls(); ok(u.host === `http://localhost:${room.port}/?room=${room.code}&seed=${room.seed}&coop=host` && room.seed >= 1 && info.seed === room.seed && coopParseUrl(new URL(u.host).search).seed === room.seed && u.guests.every(g => /^http:\/\/\d+\.\d+\.\d+\.\d+:\d+\/\?room=[A-Z0-9]{5}&seed=\d+$/.test(g)), 'the printed links: the host on localhost with coop=host, a guest link per LAN address (' + u.guests.length + ' here), the same room and seed in all'); }

  grp('the LAN room refuses what it must: no such room, room full, bad request, bad frames, a dead socket');
  { const notes = [], closes = [], g0 = wsT('NOPE1', 'guest', 'x'); g0.onNotice(n => notes.push(n)).onClose(c => closes.push(c)).open(); await until(() => closes.length, 3000, 'the no-room close');
    ok(notes[0] && notes[0].sys === 'error' && notes[0].code === 'no-room' && closes[0].code === 4404 && closes[0].fatal && !closes[0].retry && g0.state === 'closed', 'a guest for a room nobody made: {"sys":"error","code":"no-room"}, close 4404, no retry');
    const gs = createCoopSession({ role:'guest', room:'NOPE2', transport:wsT('NOPE2', 'guest', 'x') }); gs.start(); await until(() => gs.state === 'ended', 3000, 'the session to end'); ok(gs.reason === 'no-room', 'the session ends with reason "no-room"');
    const h = wsT('FULL1', 'host', 'An'), g = wsT('full1', 'guest', 'Bình'), hn = [], gn = [], hm = []; h.onNotice(n => hn.push(n)).onMessage((d, b) => hm.push([d, b])).open(); await until(() => hn.length, 3000, 'host joined'); g.onNotice(n => gn.push(n)).open(); await until(() => gn.length && hn.length > 1, 3000, 'guest joined');
    ok(hn[0].sys === 'joined' && hn[0].role === 'host' && hn[0].peer === false && hn[1].sys === 'peer-join' && hn[1].name === 'Bình' && gn[0].sys === 'joined' && gn[0].room === 'FULL1' && gn[0].peer === true && gn[0].peerName === 'An', 'host then guest: joined / peer-join, names passed on, the room code is not case-sensitive');
    const c3 = [], g3 = wsT('FULL1', 'guest', 'third'), n3 = []; g3.onNotice(n => n3.push(n)).onClose(c => c3.push(c)).open(); const c4 = [], h4 = wsT('FULL1', 'host', 'second host'); h4.onClose(c => c4.push(c)).open(); await until(() => c3.length && c4.length, 3000, 'the room-full closes');
    ok(n3[0].code === 'room-full' && c3[0].code === 4409 && c3[0].fatal && c4[0].code === 4409 && room.rooms.get('FULL1').guest && room.rooms.get('FULL1').host, 'a third player (guest or host): "room-full", close 4409 — the two inside are untouched');
    const bad = await rawClient('/ws?room=FULL1&role=spectator'); raws.push(bad); await until(() => bad.closed, 3000, 'bad-request close'); const bf = bad.frames.find(f => f.op === 8);
    ok(/"bad-request"/.test(bad.texts()[0]) && bf && bf.data.readUInt16BE(0) === 4400 && /^HTTP\/1\.1 101/.test(bad.head) && bad.head.includes(crypto.createHash('sha1').update(bad.key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')), 'role=spectator: handshake accepted (correct Sec-WebSocket-Accept), then "bad-request" and close 4400');
    const np = await rawClient('/chat'); raws.push(np); await until(() => np.closed, 3000, '404 close'); const og = await new Promise(res => { const s = net.connect(room.port, '127.0.0.1', () => s.write(`GET /ws?room=FULL1&role=guest HTTP/1.1\r\nHost: 127.0.0.1:${room.port}\r\nOrigin: http://evil.example\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n\r\n`)); let d = ''; s.on('data', x => d += x); s.on('close', () => res(d)); s.on('error', () => res(d)); });
    ok(/^HTTP\/1\.1 404/.test(np.head) && /^HTTP\/1\.1 403/.test(og), 'an upgrade on another path: 404; a page from another origin: 403');
    // relay: text, binary up to 64 KB, a fragmented message, a sys-looking frame is not relayed
    g.close(); await until(() => hn.some(n => n.sys === 'peer-leave'), 3000, 'peer-leave'); const rg = await rawClient('/ws?room=FULL1&role=guest&name=raw'); raws.push(rg); await until(() => hn.filter(n => n.sys === 'peer-join').length === 2, 3000, 'raw guest joined');
    const big = crypto.randomBytes(65536); rg.send(1, 'xin chào ✓'); rg.send(2, big); rg.send(1, 'một nửa, ', { fin:false }); rg.send(9, 'ping-in-the-middle'); rg.send(0, 'nửa kia', { fin:true }); rg.send(1, '{"sys":"peer-leave","role":"host"}'); rg.send(1, '{"sys":"ping","t":41}');
    await until(() => hm.length >= 3 && rg.texts().some(t => /"pong"/.test(t)), 3000, 'relayed messages');
    ok(hm.length === 3 && hm[0][0] === 'xin chào ✓' && hm[0][1] === false && hm[1][1] === true && Buffer.compare(Buffer.from(hm[1][0]), big) === 0 && hm[2][0] === 'một nửa, nửa kia' && rg.frames.some(f => f.op === 10 && f.data.toString() === 'ping-in-the-middle') && rg.texts().includes('{"sys":"pong","t":41}') && hn.filter(n => n.sys === 'peer-leave').length === 1 && rg.frames.every(f => !f.masked),
      'text, a 64 KB binary message and a fragmented one arrive whole; a ping inside a fragment is answered; a forged {"sys":…} is not relayed; the server never masks');
    h.send('to the guest'); h.send(new Uint8Array([1, 2, 3, 250])); await until(() => rg.frames.filter(f => f.op === 2).length, 3000, 'host → raw'); ok(rg.texts().includes('to the guest') && rg.frames.find(f => f.op === 2).data.join() === '1,2,3,250', 'host → guest: text and binary');
    rg.send(2, crypto.randomBytes(65537)); await until(() => rg.closed, 3000, 'too-big close'); ok(rg.frames.at(-1).op === 8 && rg.frames.at(-1).data.readUInt16BE(0) === 1009, 'a message over 64 KB: close 1009');
    const um = await rawClient('/ws?room=FULL1&role=guest'); raws.push(um); um.send(1, 'not masked', { mask:false }); await until(() => um.closed, 3000, 'unmasked close'); ok(um.frames.at(-1).op === 8 && um.frames.at(-1).data.readUInt16BE(0) === 1002, 'an unmasked client frame: close 1002');
    await until(() => !room.rooms.get('FULL1').guest && room.conns.size === 1, 3000, 'the refused ones to be gone'); const before = room.conns.size, dead = await rawClient('/ws?room=FULL1&role=guest&name=dead', { pong:false }); raws.push(dead); await until(() => room.conns.size === before + 1 && room.rooms.get('FULL1').guest, 3000, 'the silent one in'); const t0 = Date.now(); await until(() => dead.closed, 3000, 'the heartbeat to drop it');
    say(dead.frames.some(f => f.op === 9) && Date.now() - t0 < 1500 && room.conns.size === before && h.state === 'open', `a socket that stops answering pings is dropped by the heartbeat (${Date.now() - t0} ms at a 400 ms beat); the one that answers stays`);
    await until(() => h.stats.pongs > 1, 3000, 'a pong'); say(h.rtt >= 0 && h.rtt < 100, `round trip to the relay: ${h.rtt.toFixed(2)} ms`); h.close(); }

  grp(`a battle through the LAN room: ${COOP.snapHz} snapshots/s of 80 moving entities for ${SECONDS} simulated seconds, ${COOP.inputHz} inputs/s back`);
  { const T0 = 50000, SKEW = 9e6; let simT = null; const nowH = () => simT == null ? performance.now() : simT, nowG = () => simT == null ? performance.now() + SKEW : simT + SKEW;
    const H = createCoopSession({ role:'host', room:'FIGHT', name:'An', transport:wsT('FIGHT', 'host', 'An'), now:nowH }), G = createCoopSession({ role:'guest', room:'FIGHT', name:'Bình', transport:wsT('FIGHT', 'guest', 'Bình'), now:nowG });
    H.start(); await until(() => H.state === 'lobby', 3000, 'host in the lobby'); G.start(); await until(() => G.state === 'lobby' && H.peerName === 'Bình' && G.peerName === 'An', 3000, 'hello both ways');
    H.setSettings({ seed:20261126, battle:{ biome:'DESERT', level:3, tod:'noon', wx:'clear' } }); H.setReady(true); await until(() => G.seed === 20261126, 3000, 'settings at the guest'); ok(G.battle.biome === 'DESERT' && G.state === 'lobby' && H.state === 'lobby', 'join + hello + settings over the socket');
    G.setReady(true); await until(() => H.state === 'ready' && G.state === 'ready', 3000, 'ready'); await until(() => H.pongs > 0 && G.pongs > 0, 4000, 'peer ping'); const rtt = { host:+H.rtt.toFixed(2), guest:+G.rtt.toFixed(2) };
    ok(H.begin() && H.state === 'playing', 'ready → begin'); await until(() => G.state === 'playing', 3000, 'guest playing'); say(G.seed === 20261126 && rtt.guest < 100, `the guest plays the same seed; peer round trip through the relay ${rtt.guest} ms (host ${rtt.host} ms)`);
    const W = makeWorld(2026), truth = new Map(), gEv = [], hEv = [], out = makeInterpOut(), p = {}, graves = new Map(), R0 = room.rooms.get('FIGHT'), srv0 = { g:R0.toGuestBytes, h:R0.toHostBytes, gm:R0.toGuest, hm:R0.toHost };
    let badSnap = 0, snapsSent = 0, snapBytes = 0, inSent = 0, inBytes = 0, fullOnly = 0, lastIn = null, maxLin = 0, maxHeli = 0, maxCirc = 0, lerp = 0, other = 0, hPushed = 0, gPushed = 0, born = 0, gone = 0, nextDraw = 0, minB = 1e9, maxB = 0, lastT = 0;
    G.on('snapshot', f => { const w = truth.get(f.tick); if(!w || !sameEnt(w, f) || f.np !== 2) badSnap++; }); G.on('event', (t, a, b, x, y, z, pp) => gEv.push([t, a | b << 16, x, pp])); H.on('event', (t, a, b, x, y, z, pp) => hEv.push([t, a | b << 16, x, pp])); H.on('input', st => { lastIn = Object.assign({}, st); });
    const wall0 = performance.now();
    for(let t = 0; t <= SECONDS * 1000; t++){ simT = T0 + t;
      if(t % 125 === 0){ hPushed++; H.sendEvent(P.NET_EV.SHOT, hPushed & 0xffff, hPushed >> 16, hPushed * 0.01, 1.5, -2, 3); } if(t % 200 === 0){ gPushed++; G.sendEvent(P.NET_EV.HIT, gPushed & 0xffff, gPushed >> 16, gPushed * 0.01, 0, 0, 25); }
      if(H.snapDue(simT)){ const s = W.step(t); if(s){ graves.set(s.dead.id, s.dead); hPushed += 2; H.sendEvent(P.NET_EV.DEATH, (hPushed - 1) & 0xffff, (hPushed - 1) >> 16, 0, 0, 0, 0); H.sendEvent(P.NET_EV.EXPLOSION, hPushed & 0xffff, hPushed >> 16, 0, 0, 0, 60); }
        const f = H.frame(); W.fill(f, t); P.netFramePlayer(f, hostMan(t)); P.netFramePlayer(f, lastIn || guestMan(t)); const n = H.broadcast(f); truth.set(f.tick, keep(f)); snapsSent++; snapBytes += n; minB = Math.min(minB, n); maxB = Math.max(maxB, n); fullOnly += P.packSnapshot(f, null).length;
        await until(() => G.stats.snapsIn === snapsSent, 3000, 'snapshot ' + snapsSent + ' at the guest'); }
      if(G.inputDue(simT + SKEW)){ lastT = t; inBytes += G.sendInput(guestMan(t)); inSent++; await until(() => H.stats.inputsIn === inSent, 3000, 'input ' + inSent + ' at the host'); }
      if(t >= nextDraw){ nextDraw += 1000 / 60; G.sample(simT + SKEW, out); born += out.nBorn; gone += out.nGone; if(out.mode !== 'lerp'){ other++; continue; } lerp++;
        for(let i = 0; i < out.n; i++){ const e = W.byId(out.id[i]); if(!e) continue; W.pos(e, out.t - T0, p); const d = Math.hypot(out.x[i] - p.x, out.z[i] - p.z); if(e.type === 'circle') maxCirc = Math.max(maxCirc, d); else if(e.type === 'heli') maxHeli = Math.max(maxHeli, Math.hypot(d, out.y[i] - p.y)); else maxLin = Math.max(maxLin, Math.hypot(d, out.y[i] - p.y)); } } }
    const wall = performance.now() - wall0, S = SECONDS, R1 = room.rooms.get('FIGHT');
    for(let k = 0; k < 4 && (H.outbox.pending || G.outbox.pending); k++){ simT += 50; lastT = simT - T0; const f = H.frame(); W.fill(f, lastT); P.netFramePlayer(f, hostMan(lastT)); P.netFramePlayer(f, guestMan(lastT)); H.broadcast(f); truth.set(f.tick, keep(f)); snapsSent++; await until(() => G.stats.snapsIn === snapsSent, 3000, 'flush'); G.sendInput(guestMan(lastT)); inSent++; await until(() => H.stats.inputsIn === inSent, 3000, 'flush'); }
    say(Math.abs(snapsSent - S * COOP.snapHz) <= 6 && badSnap === 0 && G.decoder.fulls === 1 && G.decoder.errors === 0 && G.decoder.stale === 0 && G.stats.errors === 0 && room.stats.dropped === 0, `${snapsSent} snapshots relayed, every one decoded equal to the host's world (1 full, ${G.decoder.deltas} deltas)`);
    const gm = guestMan(lastT); say(Math.abs(inSent - S * COOP.inputHz) <= 6 && H.stats.inputsIn === inSent && H.stats.errors === 0 && lastIn && lastIn.weapon === 7 && lastIn.stance === P.NET_STANCE.CROUCH && Math.abs(lastIn.x - gm.x) < 0.006 && Math.abs(lastIn.z - gm.z) < 0.006 && Math.abs(lastIn.aimPitch - 0.2) < 1e-3, `${inSent} guest inputs reached the host, the last one his real state`);
    say(gEv.length === hPushed && gEv.every((v, i) => v[1] === i + 1) && hEv.length === gPushed && hEv.every((v, i) => v[1] === i + 1 && v[0] === P.NET_EV.HIT && v[3] === 25 && Math.abs(v[2] - (i + 1) * 0.01) < 0.006) && H.outbox.lost === 0, `${hPushed} host events (shots, deaths, explosions) and ${gPushed} guest events arrived once each, in order`);
    say(lerp > S * 50 && maxLin < 0.05 && maxHeli < 0.05, `guest interpolation at ${COOP.interp.delayMs} ms delay: straight-line error ${(maxLin * 100).toFixed(2)} cm on foot, ${(maxHeli * 100).toFixed(2)} cm for a helicopter at 18 m/s (limit 5 cm); circling at 4 m/s ${(maxCirc * 100).toFixed(2)} cm; ${lerp} frames drawn between two snapshots, ${other} not; ${born} appeared, ${gone} went`);
    const srvG = R1.toGuestBytes - srv0.g, srvH = R1.toHostBytes - srv0.h, msgG = R1.toGuest - srv0.gm, msgH = R1.toHost - srv0.hm;
    const down = snapBytes / S, up = inBytes / S, wireDown = (srvG + msgG * 4 + msgG * 52) / S, wireUp = (srvH + msgH * 8 + msgH * 52) / S;
    say(down > 2000 && down < 20000 && up < 3000 && srvG >= snapBytes && srvH >= inBytes, `bytes a second: host → guest ${Math.round(down)} B/s (snapshots ${minB}–${maxB} B, ${Math.round(snapBytes / snapsSent)} B on average; full snapshots would be ${Math.round(fullOnly / S)} B/s), guest → host ${Math.round(up)} B/s`);
    console.log(`    on the wire with WebSocket + TCP/IP headers (≈ 56 / 60 B a message) and pings: host → guest ≈ ${(wireDown / 1024).toFixed(1)} KB/s, guest → host ≈ ${(wireUp / 1024).toFixed(1)} KB/s   (${Math.round(wall)} ms of real time for ${S} simulated seconds)`);
    Object.assign(report, { seconds:S, snapshots:snapsSent, inputs:inSent, hostToGuestBps:Math.round(down), guestToHostBps:Math.round(up), wireHostToGuestBps:Math.round(wireDown), wireGuestToHostBps:Math.round(wireUp), fullOnlyBps:Math.round(fullOnly / S), snapBytesAvg:Math.round(snapBytes / snapsSent), snapBytesMax:maxB, inputBytes:Math.round(inBytes / inSent), interpLinearCm:+(maxLin * 100).toFixed(2), interpHeliCm:+(maxHeli * 100).toFixed(2), interpCircleCm:+(maxCirc * 100).toFixed(2), rttMs:rtt });

    grp('the server drops both sockets mid-battle: both come back by themselves and the battle goes on');
    const hc = [], gc = []; H.transport.onClose(c => hc.push(c)); G.transport.onClose(c => gc.push(c)); const opens = H.transport.stats.opens + G.transport.stats.opens, n0 = room.dropAll();
    await until(() => hc.length && gc.length, 3000, 'both to notice'); ok(n0 === 2 && hc[0].retry && gc[0].retry && !hc[0].fatal && H.state === 'playing' && G.state === 'playing' && H.peerLost && G.peerLost && H.broadcast(H.frame()) === 0, 'both lines down: the sessions stay in the battle, marked "peer lost", nothing is sent');
    hPushed++; H.sendEvent(P.NET_EV.RADIO, hPushed & 0xffff, hPushed >> 16, 0, 0, 0, 7); gPushed++; G.sendEvent(P.NET_EV.MARK, gPushed & 0xffff, gPushed >> 16, 0, 0, 0, 1);   // said while the line was down
    await until(() => H.peer && G.peer && !H.peerLost && !G.peerLost && H.transport.state === 'open' && G.transport.state === 'open', 5000, 'both back');
    const fulls0 = G.decoder.fulls, errs0 = G.decoder.errors; let bad2 = 0, sent2 = 0; const in0 = H.stats.inputsIn, sn0 = G.stats.snapsIn; G.on('snapshot', f => { if(f.n !== 80 || f.np !== 2) bad2++; });
    for(let k = 0; k < 30; k++){ simT += 50; const f = H.frame(); W.step(simT - T0); W.fill(f, simT - T0); P.netFramePlayer(f, hostMan(simT - T0)); P.netFramePlayer(f, guestMan(simT - T0)); if(H.broadcast(f) > 0){ truth.set(f.tick, keep(f)); sent2++; await until(() => G.stats.snapsIn === sn0 + sent2, 3000, 'snapshot after reconnect'); } G.sendInput(guestMan(simT - T0)); await until(() => H.stats.inputsIn === in0 + k + 1, 3000, 'input after reconnect'); }
    say(H.transport.stats.opens + G.transport.stats.opens === opens + 2 && sent2 === 30 && badSnap === 0 && bad2 === 0 && G.decoder.errors === errs0 && G.decoder.fulls === fulls0 && H.state === 'playing' && G.state === 'playing', `reconnected (${hc[0].code}); 30 more snapshots decoded intact — still deltas against what the guest held, no full resend needed`);
    ok(gEv.length === hPushed && gEv.at(-1)[0] === P.NET_EV.RADIO && gEv.at(-1)[3] === 7 && hEv.length === gPushed && hEv.at(-1)[0] === P.NET_EV.MARK, 'the events raised while the line was down arrived after it came back — once');
    report.reconnect = { closeCode:hc[0].code, retries:H.transport.stats.retries + G.transport.stats.retries };

    grp('the end: the host leaves, the room empties and is dropped');
    H.stop('done'); await until(() => G.state === 'ended', 3000, 'the guest to end'); ok(G.reason === 'done' && H.state === 'ended' && H.transport.state === 'closed' && G.transport.state === 'closed', 'the host ends the battle → the guest ends with the same reason; both lines closed');
    await until(() => !room.rooms.has('FIGHT'), 3000, 'the room to be dropped'); await until(() => room.rooms.size === 0 && room.conns.size === 0, 3000, 'every room to be dropped'); ok(room.rooms.size === 0 && room.conns.size === 0, 'no room and no socket is left on the server (rooms are dropped ' + 300 + ' ms after the last player in this test, 20 s in real use)'); }
}catch(e){ fail++; console.log('  ✗ ' + (e && e.stack || e)); }
finally{ for(const t of opened){ try{ t.close(); }catch(e){} } for(const r of raws){ try{ r.s.destroy(); }catch(e){} } await room.close(); await sleep(50); }

const left = process._getActiveHandles().filter(h => !(h === process.stdout || h === process.stderr || h === process.stdin) && !(h.constructor && /Timeout|Timer/.test(h.constructor.name) && h.hasRef && !h.hasRef()));
ok(left.length === 0, 'everything opened was closed (' + left.length + ' handle(s) left: ' + left.map(h => h.constructor && h.constructor.name).join(', ') + ')');
if(argv.includes('--json')) console.log(JSON.stringify(report));
console.log(`\n${fail === 0 ? '✓ PASS' : '✗ FAIL'} — coop-test: ${pass} checks passed, ${fail} failed`);
setTimeout(() => { console.log('✗ coop-test did not exit by itself — something is still open'); process.exit(1); }, 5000).unref();
process.exitCode = fail === 0 ? 0 : 1;
