#!/usr/bin/env node
// tools/coop-test.mjs — COOP 3 THE CO-OP NET LAYER TESTED WITHOUT A BROWSER: `npm run coop-test` (≈ 3 s, plain Node 22, no GPU, no page).
//   part 1 (no socket): the wire format round-trips, bad bytes throw CoopProtocolError, deltas heal under 20 % loss, events arrive once and in order
//   part 2 (a real tools/lan-room.mjs on 127.0.0.1, a free port; a fake host and a fake guest through net/transport.js):
//     join / ready handshake · room-full / no-such-room / bad-request · static files (and what must NOT be served) · 20 snapshots / s of 80 moving
//     entities for 10 simulated seconds relayed intact · the guest's inputs at the host · the guest's interpolation error for straight-line motion
//     under 5 cm at the configured delay · reconnect after the server drops both sockets · the room dropped once empty
//   and it REPORTS the measured bytes a second each way. Exit code 0 only when every check passed; it closes every server and socket it opened.
//   options: --seconds 10 (simulated battle length) · --json (one line of numbers at the end)
import { COOP, COOP2 } from '../config.js';
import * as P from '../src/net/protocol.js';
import { createSnapInterp, makeInterpOut } from '../src/net/interp.js';
import { createWsTransport, createLoopbackPair } from '../src/net/transport.js';
import { createCoopSession, coopStart, coopActive, coopIsHost, coopParseUrl, coopWsUrl, coopBroadcast, coopSendInput, coopState } from '../src/net/coop.js';
import * as R from '../src/net/rules.js';
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
  P.netFrameReset(g, 1, 0); let added = 0; for(let id = 1; id <= COOP.limits.entities + 10; id++) if(P.netFrameAdd(g, id, 1, 0, 0, 0, 0, 0, 1)) added++; ok(added === COOP.limits.entities && g.over === 10, 'over ' + COOP.limits.entities + ' entities the rest are left out and counted, nothing throws');
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

// ---------- COOP 4–7: what the game's side sends and the rules both pages keep (src/net/rules.js) ----------
grp('the lobby: who is ready, the start, a radio line, two fields that differ');
{ const clock = { t:5000 }, [ta, tb] = createLoopbackPair({ hostName:'Chủ', guestName:'Khách' }), H = createCoopSession({ role:'host', room:'LOB', name:'Chủ', transport:ta, now:() => clock.t, timers:false }), G = createCoopSession({ role:'guest', room:'LOB', name:'Khách', transport:tb, now:() => clock.t + 4242, timers:false });
  const said = [], fields = []; G.on('say', (t, k) => said.push(t + '|' + k)); H.on('field', same => fields.push('h' + same)); G.on('field', same => fields.push('g' + same)); H.start(); G.start();
  const battle = { biome:'MEADOW', level:2, tod:'sunset', wx:'rain', mobile:false, arena:184, quality:'high' }; H.setSettings({ seed:31337, battle }); const early = H.say('too early') === false;
  ok(G.seed === 31337 && G.battle.biome === 'MEADOW' && G.battle.level === 2 && G.battle.arena === 184 && G.battle.mobile === false && early, 'the guest sees the battlefield the host picked (biome, stage, hour, weather, the machine it was built for); no radio line crosses a lobby');
  G.setReady(true); const half = H.state === 'lobby' && H.peerReady === true && H.ready === false; H.setReady(true); const both = H.state === 'ready' && G.state === 'ready';
  H.setSettings({ seed:31337, battle:Object.assign({}, battle, { biome:'CITY' }) }); const reset = H.state === 'lobby' && G.ready === false && G.battle.biome === 'CITY'; G.setReady(true);
  ok(half && both && reset && H.state === 'ready' && H.begin() && G.state === 'playing' && G.battle.biome === 'CITY', 'ready, ready → the host may start; a new choice asks the guest again; start → both playing the battle last agreed');
  ok(H.say('TÌNH BÁO: trực thăng địch', 'heli') === true && G.say('x') === true && said.length === 1 && said[0] === 'TÌNH BÁO: trực thăng địch|heli' && H.say('y'.repeat(999)) && said[1].length === COOP.sayMax + 1, 'a line of the host\'s radio reaches the guest\'s, cut to ' + COOP.sayMax + ' letters');
  H.setFieldHash(111, 'stage 1'); G.setFieldHash(111, 'stage 1'); const same1 = fields.join() === 'gtrue,htrue' || fields.join() === 'htrue,gtrue'; H.setFieldHash(222, 'stage 2'); const wait = fields.length === 2; G.setFieldHash(223, 'stage 2');
  ok(same1 && wait && fields.length === 4 && fields.slice(2).every(f => /false/.test(f)) && H.fieldOk === false && G.fieldOk === false, 'fingerprint: the same land says so on both pages; the next stage is compared only once both built it — and one number off is "not the same field" on both');
  H.stop(); }

grp('each page sends its soldier at its rate, and it is drawn on the other from the interpolation buffer');
{ const clock = { t:9000 }, [ta, tb] = createLoopbackPair(), H = createCoopSession({ role:'host', transport:ta, now:() => clock.t, timers:false }), G = createCoopSession({ role:'guest', transport:tb, now:() => clock.t, timers:false });
  H.start(); G.start(); H.setSettings({ seed:5, battle:{ biome:'DESERT' } }); H.setReady(true); G.setReady(true); H.begin();
  const F = P.NET_PFLAG, T = P.NET_STANCE, man = (id, t, fl, st) => ({ id, x:10 + t * 0.004, y:1.25, z:-30 + t * 0.002, heading:1.2, aimYaw:2.9, aimPitch:-0.2, vx:4, vz:2, stance:st, weapon:5, flags:fl, hp:63, hpMax:150, mount:2 });
  let nIn = 0, nSnap = 0, maxG = 0, maxH = 0, flagsOk = true; const t0 = clock.t;
  for(let ms = 0; ms < 2000; ms += 4){ clock.t = t0 + ms; const t = clock.t;
    if(G.inputDue(t)){ G.sendInput(man(COOP.ids.guest, ms, F.FIRING | F.MOUNTED | F.DOWNED, T.PILLION)); nIn++; }
    if(H.snapDue(t)){ const f = H.frame(); P.netFramePlayer(f, man(COOP.ids.host, ms, F.RELOADING | F.SPRINT, T.CROUCH)); H.broadcast(f); nSnap++; }
    if(ms > 400 && ms % 16 === 0){ const og = G.sample(t), oh = H.sample(t), dg = ms - COOP.interp.delayMs, dh = ms - COOP.interp.inputDelayMs;
      if(og.np === 1 && og.mode === 'lerp'){ maxG = Math.max(maxG, Math.hypot(og.pl[0].x - (10 + dg * 0.004), og.pl[0].z - (-30 + dg * 0.002))); flagsOk = flagsOk && og.pl[0].id === COOP.ids.host && og.pl[0].flags === (F.RELOADING | F.SPRINT) && og.pl[0].stance === T.CROUCH && og.pl[0].weapon === 5 && og.pl[0].hp === 63 && og.pl[0].hpMax === 150 && og.pl[0].mount === 2 && Math.abs(og.pl[0].aimYaw - 2.9) < 0.001 && Math.abs(og.pl[0].aimPitch + 0.2) < 0.001 && Math.abs(og.pl[0].y - 1.25) < 0.006; }
      if(oh.np === 1 && oh.mode === 'lerp'){ maxH = Math.max(maxH, Math.hypot(oh.pl[0].x - (10 + dh * 0.004), oh.pl[0].z - (-30 + dh * 0.002))); flagsOk = flagsOk && oh.pl[0].id === COOP.ids.guest && oh.pl[0].flags === (F.FIRING | F.MOUNTED | F.DOWNED) && oh.pl[0].stance === T.PILLION; } } }
  say(nIn >= COOP.inputHz * 2 - 2 && nIn <= COOP.inputHz * 2 + 2 && nSnap >= COOP.snapHz * 2 - 2 && nSnap <= COOP.snapHz * 2 + 2 && H.stats.inputsIn === nIn && G.stats.snapsIn === nSnap, `2 s of play: ${nIn} states guest → host (${COOP.inputHz} / s), ${nSnap} snapshots host → guest (${COOP.snapHz} / s), none lost on a clean line`);
  say(flagsOk && maxG < 0.02 && maxH < 0.02 && maxG > 0, `the other soldier is drawn within ${(Math.max(maxG, maxH) * 100).toFixed(1)} cm of where he was (4.5 m/s), with his stance, weapon, ride, health and flags — firing, reloading, mounted, DOWN — intact`);
  report.playerBytesPerS = { guestToHost:Math.round(G.stats.bytesOut / 2), hostToGuest:Math.round(H.stats.bytesOut / 2) };
  say(G.stats.bytesOut / 2 < 2000 && H.stats.bytesOut / 2 < 2000, `a soldier alone costs ${Math.round(G.stats.bytesOut / 2)} B/s guest → host and ${Math.round(H.stats.bytesOut / 2)} B/s host → guest (no enemy in the snapshot)`);
  // hit reports, and what comes back
  const hits = [], back = []; H.on('event', (t, a, b, x, y, z, p) => { if(t === P.NET_EV.HIT) hits.push([a, b, x, z, R.coopHitOf(p)]); }); G.on('event', (t, a, b, x, y, z, p) => back.push([t, a, b, p]));
  G.sendEvent(P.NET_EV.HIT, COOP.ids.guest, 77, 0.6, 0, -0.8, R.coopHitP(34.56, false)); G.sendEvent(P.NET_EV.HIT, COOP.ids.guest, 78, 1, 0, 0, R.coopHitP(900, true)); G.sendEvent(P.NET_EV.HIT, COOP.ids.guest, 79, 0, 0, 1, R.coopHitP(1e9, false));
  H.sendEvent(P.NET_EV.DEATH, 78, 1, 1, 2.5, 0, 0); H.sendEvent(P.NET_EV.HIT, 0, COOP.ids.guest, 0, 0, 1, R.coopHitP(12.3, false)); H.sendEvent(P.NET_EV.CUE, 5, 0, 0, 0, 0, R.NET_CUE.WAVE);
  for(let k = 0; k < 6; k++){ clock.t += 40; G.sendInput(man(COOP.ids.guest, 0, 0, 0)); const f = H.frame(); H.broadcast(f); }
  ok(hits.length === 3 && hits[0][0] === COOP.ids.guest && hits[0][1] === 77 && Math.abs(hits[0][2] - 0.6) < 0.006 && Math.abs(hits[0][3] + 0.8) < 0.006 && Math.abs(hits[0][4].dmg - 34.6) < 0.06 && hits[0][4].heavy === false && hits[1][4].heavy === true && hits[1][4].dmg === 900 && hits[2][4].dmg <= COOP.puppet.hitMax,
    'hit reports: the guest names the enemy, the way the round flew, the damage (to 0.1) and whether it was a heavy round; each arrives once; a report cannot take more than ' + COOP.puppet.hitMax);
  ok(back.length === 3 && back[0][0] === P.NET_EV.DEATH && back[0][1] === 78 && back[1][0] === P.NET_EV.HIT && back[1][2] === COOP.ids.guest && Math.abs(R.coopHitOf(back[1][3]).dmg - 12.3) < 0.06 && back[2][3] === R.NET_CUE.WAVE && back[2][1] === 5, 'what comes back: the death of the enemy he hit, the damage the host decided against him, the wave — in order');
  G.stop(); }

grp('the rules both pages keep: who may play together, whom an enemy regards, down and up again');
{ const pc = { mobile:false, arena:184, quality:'high' };
  ok(R.coopLobbyClash(pc, { mobile:true, arena:130, quality:'high' }) === 'mobile' && R.coopClashFatal('mobile') && R.coopLobbyClash(pc, { mobile:false, arena:130 }) === 'arena' && R.coopClashFatal('arena') && R.coopLobbyClash(pc, { mobile:false, arena:184, quality:'low' }) === 'quality' && !R.coopClashFatal('quality') && R.coopLobbyClash(pc, pc) === '' && R.coopLobbyClash(pc, {}) === '' && !R.coopClashFatal(''),
    'a phone with a desktop is refused (the two build different fields), another field size too; another picture quality only warns');
  ok(R.coopSeedUrl('http://10.0.0.2:8777/?room=AB12C', 7) === 'http://10.0.0.2:8777/?room=AB12C&seed=7' && R.coopSeedUrl('http://h/?seed=3&room=X&coop=host#dev', 99) === 'http://h/?room=X&coop=host&seed=99#dev' && R.coopSeedUrl('http://h/', 0) === 'http://h/?seed=1' && coopParseUrl(R.coopSeedUrl('?room=abcde', 4242)).seed === 4242, 'a page that must take the host\'s seed reloads at its own address with seed= set (once, kept in order)');
  const cues = Object.values(R.NET_CUE), sc = R.coopScoreAB(3123456789); ok(new Set(cues).size === cues.length && cues.every(c => c >= 1 && c <= 65535) && R.coopScoreOf(sc[0], sc[1]) === 3123456789 && R.coopScoreOf(...R.coopScoreAB(10550)) === 10550 && R.coopScoreOf(...R.coopScoreAB(-5)) === 0, 'cue codes are distinct; a 32-bit score crosses in a cue\'s two 16-bit fields');
  ok(Math.abs(R.coopMU16(R.coopU16M(-183.37)) + 183.37) < 0.006 && Math.abs(R.coopMU16(R.coopU16M(183.99)) - 183.99) < 0.006 && R.coopU16M(1e6) === 65535 && R.coopU16M(-1e6) === 0 && R.coopBlastColor(...R.coopBlastAB(0xffb050)) === 0xffb050 && R.coopBlastColor(...R.coopBlastAB(0)) === 0, 'a grenade\'s start point and an explosion\'s colour fit an event\'s 16-bit fields');
  // whom an enemy regards
  ok(R.coopFocusPick(0, 10, 30, false, false) === 0 && R.coopFocusPick(0, 30, 10, false, false) === 1 && R.coopFocusPick(0, 10, 9, false, false) === 0 && R.coopFocusPick(1, 9, 10, false, false) === 1 && R.coopFocusPick(1, 5, 10, false, false) === 0
    && R.coopFocusPick(0, 5, 50, true, false) === 1 && R.coopFocusPick(1, 50, 5, false, true) === 0 && R.coopFocusPick(1, 50, 5, true, true) === 1, 'an enemy regards the nearer player, keeps to him until the other is clearly nearer (×' + COOP.focus.stick + '), and never a man who is down while the other stands');
  // down and up
  const D = R.makeCoopDown(), up = { present:true, down:false, dist:9 }, C = COOP.down; let t = 0, res = '';
  ok(R.coopDownEnter(R.makeCoopDown(), { present:false, down:false, dist:1 }) === 'alone' && R.coopDownEnter(R.makeCoopDown(), { present:true, down:true, dist:1 }) === 'lost' && R.coopDownEnter(D, up) === 'down' && D.on && D.k === 0, 'at no health: DOWN while the other stands · the stage lost when he is down too · alone (nobody in the room) the single-player death');
  for(let i = 0; i < 100; i++) res = R.coopDownStep(D, 1 / 60, up) || res; const far = D.on && D.k === 0 && res === ''; up.dist = C.r - 0.1;
  while(D.on && t < 60){ res = R.coopDownStep(D, 1 / 60, up); t += 1 / 60; } const tUp = t; say(far && res === 'up' && Math.abs(tUp - C.reviveS) < 0.05 && !D.on, `the other stands within ${C.r} m for ${tUp.toFixed(2)} s → up again (COOP.down.reviveS = ${C.reviveS})`);
  R.coopDownEnter(D, up); for(let i = 0; i < 120; i++) R.coopDownStep(D, 1 / 60, up); const k2 = D.k; up.dist = 30; for(let i = 0; i < 60; i++) R.coopDownStep(D, 1 / 60, up); const k3 = D.k; let show = 0; up.dist = 1; for(let i = 0; i < 60; i++) show = R.coopReviveShow(show, 1 / 60, 1, true);
  ok(Math.abs(k2 - 2 / C.reviveS) < 0.01 && k3 < k2 && k3 > 0 && Math.abs(k3 - (k2 - 1 / C.reviveS * C.decay)) < 0.01 && Math.abs(show - 1 / C.reviveS) < 0.01 && R.coopReviveShow(0.5, 1, 1, false) === 0, 'stepping away lets the count fall back (slower than it rose); the reviver\'s page shows the same count from the DOWNED flag and the distance alone');
  up.down = true; const lost = R.coopDownStep(D, 1 / 60, up) === 'lost' && D.lost; up.down = false; up.present = false; ok(lost && R.coopDownStep(D, 1 / 60, up) === 'alone' && !D.on && R.coopDownStep(D, 1, up) === '', 'both down → the stage is lost; the other leaves the room → he gets up by himself'); }

grp('who may say what: the host is the authority — a guest cannot hurt the host\'s soldier, end the stage, set the score, stand anyone up');
{ const clock = { t:20000 }, [ta, tb] = createLoopbackPair(), H = createCoopSession({ role:'host', transport:ta, now:() => clock.t, timers:false }), G = createCoopSession({ role:'guest', transport:tb, now:() => clock.t, timers:false });
  H.start(); G.start(); H.setSettings({ seed:9, battle:{ biome:'DESERT' } }); H.setReady(true); G.setReady(true); H.begin();
  // the same gate game/coop-glue.js onEvent puts first: what does not pass is counted and nothing is done
  const E = P.NET_EV, C = R.NET_CUE, hostDid = [], guestDid = []; let hostDrop = 0, guestDrop = 0;
  H.on('event', (t, a, b, x, y, z, p) => { if(R.coopEventAllowed(true, t, a, b, p)) hostDid.push(t + ':' + p); else hostDrop++; }); G.on('event', (t, a, b, x, y, z, p) => { if(R.coopEventAllowed(false, t, a, b, p)) guestDid.push(t + ':' + p); else guestDrop++; });
  const pump = () => { for(let k = 0; k < 4; k++){ clock.t += 40; G.sendInput({ id:COOP.ids.guest, x:0, z:0 }); H.broadcast(H.frame()); } };
  G.sendEvent(E.HIT, 0, COOP.ids.host, 1, 0, 0, R.coopHitP(9999, true)); G.sendEvent(E.HIT, COOP.ids.guest, COOP.ids.host, 1, 0, 0, R.coopHitP(50, false)); G.sendEvent(E.HIT, COOP.ids.guest, COOP.ids.guest, 0, 0, 1, R.coopHitP(50, false)); G.sendEvent(E.HIT, COOP.ids.host, 40, 0, 0, 1, R.coopHitP(50, false)); pump();
  ok(hostDid.length === 0 && hostDrop === 4, 'a HIT from the guest that names a player (the host\'s soldier, or his own), or that claims to come from the host, is ignored: ' + hostDrop + ' of 4 dropped');
  for(const p of [C.WON, C.LOST, C.SCORE, C.WAVE, C.PHASE, C.UP, C.DOWN, C.GO, 0, 77, 65535]) G.sendEvent(E.CUE, 2, 2, 0, 0, 0, p); for(const t of [E.DEATH, E.EXPLOSION, E.GRENADE, E.RADIO, E.MARK, E.SHOT, 0, 99, 255]) G.sendEvent(t, 20, 1, 1, 1, 1, 500); pump(); pump(); pump();
  ok(hostDid.length === 0 && hostDrop === 4 + 11 + 9, 'a guest cannot end the stage (WON / LOST), set the score or the wave, say DOWN / UP / GO, kill an enemy by decree, or make an explosion: every one of 20 such events is dropped');
  G.sendEvent(E.HIT, COOP.ids.guest, 40, 1, 0.05, 0, R.coopHitP(30, false)); G.sendEvent(E.CUE, COOP.ids.guest, 3, 0, 0, 0, C.GATE); G.sendEvent(E.CUE, COOP.ids.guest, 0, 0, 0, 0, C.GATE); G.sendEvent(E.CUE, COOP.ids.host, 3, 0, 0, 0, C.GATE); G.sendEvent(E.HIT, COOP.ids.guest, COOP.ids.firstEntity - 1, 1, 0, 0, 5); pump(); pump();
  ok(hostDid.join() === E.HIT + ':' + R.coopHitP(30, false) + ',' + E.CUE + ':' + C.GATE && hostDrop === 27, 'what the host does take from the guest: a hit report against an enemy id, and "I am at the gate of stage 3" — with ids and stage numbers in range');
  H.sendEvent(E.HIT, 0, COOP.ids.guest, 0, 0, 1, R.coopHitP(12, false)); H.sendEvent(E.DEATH, 40, 1, 0, 1, 0, 0); H.sendEvent(E.EXPLOSION, 255, 80, 1, 0, 2, 150); H.sendEvent(E.GRENADE, 100, 100, 1, 2, 3, 900); H.sendEvent(E.MARK, 1, 0, 5, 0, 5, 0);
  for(const p of [C.GO, C.WON, C.LOST, C.SCORE, C.WAVE, C.PHASE, C.UP, C.DOWN]) H.sendEvent(E.CUE, 2, 2, 0, 0, 0, p); H.sendEvent(E.HIT, 0, COOP.ids.host, 0, 0, 1, 5); H.sendEvent(E.CUE, 0, 0, 0, 0, 0, 4242); H.sendEvent(E.DEATH, 3, 0, 0, 0, 0, 0); H.sendEvent(E.GRENADE, 1, 1, 1, 1, 1, 60000); pump(); pump(); pump();
  ok(guestDid.length === 13 && guestDrop === 4, 'the guest acts on the host\'s word for all of it (13 events), and still drops what is out of range: a hit not on him, an unknown cue, a death of a player id, a 60 s grenade');
  let threw = 0; for(const v of [NaN, Infinity, -1, 1e12, undefined, null, 'x', {}]) for(const side of [true, false]){ try{ R.coopEventAllowed(side, v, v, v, v); R.coopEventAllowed(side, E.CUE, v, v, v); R.coopEventAllowed(side, E.HIT, v, v, v); }catch(e){ threw++; } }
  ok(threw === 0 && R.coopEventAllowed(true, NaN, NaN, NaN, NaN) === false && R.coopEventAllowed(false, E.CUE, 1, 1, NaN) === false, 'malformed fields are refused, never thrown');
  G.stop(); }
grp('the host judges a hit report by its own numbers: weapon, damage, rate, range');
{ const T = COOP.trust, TR = R.makeCoopTrust(), q = (o) => Object.assign({ now:100, dmg:20, heavy:false, weapon:5, enemyAlive:true, dist:40, gunDmg:12, gunRange:70, gunHeavy:false, guestDown:false }, o), J = o => Object.assign({}, R.coopJudgeHit(TR, q(o)));
  R.coopTrustWeapon(TR, 5); const a = J({}), over = J({ dmg:5000 }), wrong = J({ weapon:9 }); R.coopTrustWeapon(TR, 9); const prev = J({ weapon:5 }), cur = J({ weapon:9 }); R.coopTrustWeapon(TR, 2); const old = J({ weapon:5 });
  ok(a.ok && a.dmg === 20 && !a.heavy && over.ok && over.dmg === 12 * T.dmgK && TR.clamped === 1 && !wrong.ok && wrong.why === 'weapon' && prev.ok && cur.ok && !old.ok, `a report in order is taken as it is; 5000 damage from a 12-damage rifle is cut to ${12 * T.dmgK} (× ${T.dmgK}); a weapon his state never named is dropped (the last two count: a report may cross a change of weapon)`);
  const dead = J({ weapon:2, enemyAlive:false }), down = J({ weapon:2, guestDown:true }), far = J({ weapon:2, dist:70 * T.rangeK + 1 }), near = J({ weapon:2, dist:70 * T.rangeK - 1 }), close = J({ weapon:2, gunRange:10, dist:T.rangeMin - 1 }), zero = J({ weapon:2, dmg:0 }), nan = J({ weapon:2, dmg:NaN }), nodist = J({ weapon:2, dist:NaN });
  ok(!dead.ok && dead.why === 'no-enemy' && !down.ok && down.why === 'down' && !far.ok && far.why === 'range' && near.ok && close.ok && !zero.ok && !nan.ok && !nodist.ok, 'dropped: the enemy is gone, the guest is down, the enemy is further than the gun reaches from where he said he was, no damage, numbers that are not numbers');
  const T2 = R.makeCoopTrust(); R.coopTrustWeapon(T2, 5); let okN = 0, rate = 0; for(let i = 0; i < 200; i++){ const r = R.coopJudgeHit(T2, q({ now:50 })); if(r.ok) okN++; else if(r.why === 'rate') rate++; } const later = R.coopJudgeHit(T2, q({ now:50.5 })).ok; let okN2 = 1; for(let i = 0; i < 200; i++) if(R.coopJudgeHit(T2, q({ now:50.5 })).ok) okN2++;
  say(okN === T.hitsPerS && rate === 200 - T.hitsPerS && later && Math.abs(okN2 - T.hitsPerS / 2) <= 1, `200 reports in one instant: ${okN} taken, ${rate} dropped (COOP.trust.hitsPerS = ${T.hitsPerS}); half a second later ${okN2} more`);
  const T3 = R.makeCoopTrust(); R.coopTrustWeapon(T3, 5); let hv = 0, light = 0, big = 0; for(let i = 0; i < 20; i++){ const r = R.coopJudgeHit(T3, q({ now:10, dmg:900, heavy:true })); if(r.ok && r.heavy){ hv++; big = Math.max(big, r.dmg); } else if(r.ok && r.dmg === 12 * T.dmgK) light++; } const gun = R.coopJudgeHit(T3, q({ now:10, dmg:900, heavy:true, gunHeavy:true, gunDmg:120 }));
  ok(hv === T.heavyBurst && big === T.heavyDmg && light === 20 - T.heavyBurst && gun.ok && gun.heavy && gun.dmg === 900, `a heavy hit from a light gun (a grenade, the knife, a trample): ${T.heavyBurst} at once at most, each ${T.heavyDmg} at most — the rest count as the rifle's; a gun that fires heavy rounds needs no token`);
  let led = R.coopLedger(-1, 150, 150, 0.016, false); const init = led === 150; led = R.coopLedger(led, 90, 150, 0.016, false); const fell = led === 90; led = R.coopLedger(led, 150, 150, 1, false); const rose = led === 90 + T.healPerS; const held = R.coopLedger(60, 0, 150, 0.016, true) === 60 && R.coopLedger(60, 999, 150, 5, false) === 150 && R.coopLedger(60, -5, 150, 1, false) === 0;
  ok(init && fell && rose && held, `the host's ledger of the guest's health: his report takes it down at once, up by ${T.healPerS} a second at most, never past his most; right after the host hurt him or stood him up a staler report is not followed`); }

grp('COOP 9 the shared world: a guest cannot break a block, take loot, open a crate, drop a guard or set the Core\'s health by decree — it reports, the host judges');
{ const clock = { t:50000 }, [ta, tb] = createLoopbackPair(), H = createCoopSession({ role:'host', transport:ta, now:() => clock.t, timers:false }), G = createCoopSession({ role:'guest', transport:tb, now:() => clock.t, timers:false });
  H.start(); G.start(); H.setSettings({ seed:9, battle:{ biome:'DESERT' } }); H.setReady(true); G.setReady(true); H.begin();
  const E = P.NET_EV, L = R.NET_LOOT, W = COOP2, gid = COOP.ids.guest, hid = COOP.ids.host, hostDid = [], guestDid = []; let hostDrop = 0, guestDrop = 0;
  H.on('event', (t, a, b, x, y, z, p) => { if(R.coopEventAllowed(true, t, a, b, p)) hostDid.push(t + ':' + (p & 15)); else hostDrop++; }); G.on('event', (t, a, b, x, y, z, p) => { if(R.coopEventAllowed(false, t, a, b, p)) guestDid.push(t + ':' + (p & 15)); else guestDrop++; });
  const pump = n => { for(let k = 0; k < (n || 4); k++){ clock.t += 40; G.sendInput({ id:gid, x:0, z:0 }); H.broadcast(H.frame()); } };
  // the host's own words, forged by the guest: every one must fall at the gate
  const forged = [[E.BLOCK, 40, 1, 1], [E.BLOCK, 40, 2, 0], [E.BLOCK, hid, 40, 500], [E.BLOCK, 0, 40, 500], [E.GUARD, 3, 1, 0], [E.GUARD, hid, 17, 0], [E.SHOT, 3, 0, 100], [E.STATE, W.stateOp.CORE, 1, 100], [E.STATE, gid, 0, 100],
    [E.LOOT, 7, 61, L.DROP], [E.LOOT, 7, gid, L.TAKEN], [E.LOOT, 7, 0, L.GONE], [E.LOOT, 7, 0, L.CRATE], [E.LOOT, 7, 0, L.OPEN], [E.LOOT, gid, 7, L.TAKEN], [E.LOOT, gid, 0, L.ASK], [E.LOOT, hid, 7, L.ASK], [E.LOOT, gid, 7, 15],
    [E.PING, hid, 1, 0], [E.PING, gid, W.ping.kinds, 0], [E.PING, 0, 0, 0], [E.GIVE, hid, 30, 0], [E.GIVE, gid, 0, 0], [E.GIVE, gid, W.give.maxRounds + 1, 0], [E.GIVE, gid, 30, 99]];
  for(const [t, a, b, p] of forged) G.sendEvent(t, a, b, 1, 0, 1, p); pump(8);
  ok(hostDid.length === 0 && hostDrop === forged.length, 'a guest that says "block 40 is gone", "I took pick-up 7", "the Core has 1 health", "the crate is open", "that guard fell", or speaks with the host\'s id: all ' + forged.length + ' dropped at the gate (' + hostDrop + ')');
  const asked = [[E.BLOCK, gid, 40, R.coopHitP(30, false)], [E.GUARD, gid, 3 * 16 + 1, 0], [E.LOOT, gid, 7, L.ASK], [E.LOOT, gid, 2, L.ASKCRATE], [E.LOOT, gid, 0, L.NEED], [E.PING, gid, 0, 0], [E.PING, gid, 1, 77], [E.PING, gid, 2, 5], [E.GIVE, gid, 30, 0]];
  for(const [t, a, b, p] of asked) G.sendEvent(t, a, b, 1, 0, 1, p); pump(6);
  ok(hostDid.length === asked.length && hostDrop === forged.length, 'what passes the gate from a guest: a REPORT (a round on block 40, on a tower guard), a REQUEST (this pick-up, this crate, "I am short of rounds"), a ping, a magazine — ' + hostDid.length + ' of ' + asked.length);
  const word = [[E.BLOCK, 40, 0, 12], [E.BLOCK, 40, 2, 30000], [E.BLOCK, 40, 1, 1], [E.GUARD, 3, 17, 0], [E.SHOT, 3, 1, 4000], [E.STATE, W.stateOp.CORE, 377, 420], [E.LOOT, 7, 61 | (8 << 10) | 0x8000, L.DROP | (100 << 4) | (20 << 11)], [E.LOOT, 7, gid, L.TAKEN], [E.LOOT, 8, 0, L.GONE], [E.LOOT, 1, 0, L.CRATE], [E.LOOT, 1, 0, L.OPEN], [E.PING, hid, 1, 19], [E.GIVE, hid, 30, 0]];
  const off = [[E.BLOCK, 40, 7, 1], [E.BLOCK, 0, 1, 1], [E.GUARD, 3, 40, 0], [E.LOOT, 7, 0, 9], [E.LOOT, 0, 0, L.GONE], [E.LOOT, 7, 0, L.TAKEN | (3 << 4)], [E.PING, gid, 1, 0], [E.GIVE, hid, 0, 0], [E.STATE, 9, 1, 1], [E.STATE, W.stateOp.CORE, 5, 0]];
  for(const [t, a, b, p] of word.concat(off)) H.sendEvent(t, a, b, 1, 0, 1, p); pump(8);
  ok(guestDid.length === word.length && guestDrop === off.length, 'the guest acts on the host\'s word for the world (' + guestDid.length + ' events: a block damaged / gone, a guard down, his shot, the Core, a pick-up dropped with its flight / taken / gone, the crate, a ping, a magazine) and drops ' + guestDrop + ' out of range');
  let threw = 0; for(const v of [NaN, Infinity, -1, 1e12, undefined, null, 'x', {}]) for(const side of [true, false]) for(const t of [E.BLOCK, E.GUARD, E.LOOT, E.PING, E.GIVE, E.STATE]){ try{ if(R.coopEventAllowed(side, t, v, v, v) && typeof v !== 'number') threw++; }catch(e){ threw++; } }
  ok(threw === 0, 'malformed fields of the new events are refused, never thrown'); G.stop(); }
{ const B = COOP2.block, WT = R.makeCoopWorldTrust(), q = o => Object.assign({ now:100, dmg:40, weaponOk:true, alive:true, dist:30, gunDmg:12, gunRange:60, guestDown:false }, o), J = o => Object.assign({}, R.coopJudgeBlock(WT, q(o)));
  const a = J({}), over = J({ dmg:1e6 }), far = J({ dist:60 * B.rangeK + 1 }), near = J({ dist:60 * B.rangeK - 1 }), short = J({ gunRange:5, dist:B.rangeMin - 1 }), gone = J({ alive:false }), down = J({ guestDown:true }), wpn = J({ weaponOk:false }), zero = J({ dmg:0 }), nan = J({ dmg:NaN }), nod = J({ dist:NaN });
  ok(a.ok && a.dmg === 40 && over.ok && over.dmg === Math.max(B.dmgMin, 12 * B.dmgK) && !far.ok && far.why === 'range' && near.ok && short.ok && !gone.ok && gone.why === 'no-block' && !down.ok && !wpn.ok && wpn.why === 'weapon' && !zero.ok && !nan.ok && !nod.ok,
    `a round on a block: taken within the gun's reach × ${B.rangeK} (at least ${B.rangeMin} m) of where he said he was, cut to ${Math.max(B.dmgMin, 12 * B.dmgK)} for a 12-damage rifle; a block out of reach, already gone, a weapon he never named, a downed man: dropped`);
  const W2 = R.makeCoopWorldTrust(); let took = 0, rate = 0; for(let i = 0; i < 300; i++){ const r = R.coopJudgeBlock(W2, q({ now:10 })); if(r.ok) took++; else if(r.why === 'rate') rate++; } let later = 0; for(let i = 0; i < 300; i++) if(R.coopJudgeBlock(W2, q({ now:10.5 })).ok) later++;
  say(took === B.perS && rate === 300 - B.perS && Math.abs(later - B.perS / 2) <= 1, `300 block reports in one instant: ${took} taken (COOP2.block.perS = ${B.perS}), half a second later ${later} more — a broken page cannot flatten the field`);
  const N = { now:5, alive:true, dist:3, guestDown:false }, W3 = R.makeCoopWorldTrust(), T = COOP2.loot.takeR;
  ok(R.coopJudgeNear(W3, W3.loot, N, T) === '' && R.coopJudgeNear(W3, W3.loot, Object.assign({}, N, { dist:T + 0.5 })) === 'range' && R.coopJudgeNear(W3, W3.loot, Object.assign({}, N, { dist:164 })) === 'range' && R.coopJudgeNear(W3, W3.loot, Object.assign({}, N, { alive:false })) === 'gone'
    && R.coopJudgeNear(W3, W3.loot, Object.assign({}, N, { guestDown:true })) === 'down' && R.coopJudgeNear(W3, W3.loot, Object.assign({}, N, { dist:NaN })) === 'range', `loot: his within ${T} m of where he said he was; not from 164 m, not once it is gone, not while he is down`);
  let asks = 0; for(let i = 0; i < 100; i++) if(R.coopJudgeNear(W3, W3.loot, N, T) === '') asks++; ok(asks === COOP2.loot.asksPerS - 1 && W3.dropped >= 100 - asks, 'loot requests are rate-limited too (' + (asks + 1) + ' at once)');
  const W4 = R.makeCoopWorldTrust(); let p0 = 0; for(let i = 0; i < 100; i++) if(R.coopBucketTake(W4.ping, 20)) p0++; let p1 = 0; for(let i = 0; i < 100; i++) if(R.coopBucketTake(W4.ping, 21)) p1++; let p2 = 0; for(let i = 0; i < 100; i++) if(R.coopBucketTake(W4.ping, 21.01)) p2++;
  say(p0 === COOP2.ping.burst && p1 === COOP2.ping.perS && p2 === 0, `100 pings in one instant: ${p0} taken (COOP2.ping.burst), a second later ${p1} more (perS), then none`);
  const list = []; let out = 0; for(let i = 0; i < 7; i++) if(R.coopPingPush(list, { i })) out++; ok(list.length === COOP2.ping.max && out === 7 - COOP2.ping.max && list[0].i === 7 - COOP2.ping.max && list[list.length - 1].i === 6, 'at most ' + COOP2.ping.max + ' pings alive a player: the oldest goes');
  ok(R.coopClock(0, 10, 0) === 12 && R.coopClock(-10, 0, 0) === 3 && R.coopClock(0, -10, 0) === 6 && R.coopClock(10, 0, 0) === 9 && R.coopClock(10, 0, Math.PI / 2) === 12 && R.coopClock(-5, 8.66, 0) === 1 && R.coopClock(-8.66, 5, 0) === 2 && R.coopClock(0, 10, Math.PI) === 6
    && R.coopPingText(1, 2, 40) === 'Địch hướng 2 giờ!' && /11 giờ/.test(R.coopPingText(0, 11, 33)) && /35 mét/.test(R.coopPingText(0, 11, 33)) && /giờ/.test(R.coopPingText(2, 5, 3)) && R.coopPingText(9, 5, 3) === R.coopPingText(0, 5, 3),
    'the shout names the clock bearing from where the LISTENER looks (12 ahead, 3 to his right — the game\'s right is −x when he looks along +z): "Địch hướng 2 giờ!"');
  const D = COOP2.director, pick = o => Object.assign({}, R.coopDirPick(Object.assign({ dist:10, hostMen:3, guestMen:3, hostDmg:0, guestDmg:0, hostDown:false, guestDown:false }, o)));
  const tog = pick({}), apartG = pick({ dist:D.aloneD + 5, guestMen:0 }), apartH = pick({ dist:D.aloneD + 5, hostMen:1, guestMen:4 }), tie = pick({ dist:D.aloneD + 5, hostDmg:200, guestDmg:50 }), prG = pick({ guestDmg:300, hostDmg:100 }), prH = pick({ hostDmg:300, guestDmg:100 }), even = pick({ hostDmg:300, guestDmg:290 }), low = pick({ hostDmg:D.pressMin - 1 }), dn = pick({ guestDown:true, guestDmg:900 }), both = pick({ guestDown:true, hostDown:true });
  ok(tog.ambush === -1 && tog.press === -1 && apartG.ambush === 1 && apartH.ambush === 0 && tie.ambush === 1 && prG.press === 1 && prH.press === 0 && even.press === -1 && low.press === -1 && dn.press === 0 && dn.ambush === 0 && both.press === -1,
    'the director for two: together → nobody singled out; apart by more than ' + D.aloneD + ' m → the flank goes at the one with fewer of our men round him; the one dealing clearly most is pressed; a man down → the one standing over him draws the fire');
  ok(R.coopCountK(false) === 1 && R.coopCountK(true) === D.countK && D.countK > 1.2 && D.countK < 2, 'two players: × ' + D.countK + ' of the enemy, not × 2; one alone: × 1');
  const W5 = R.makeCoopWorldTrust(), Gv = COOP2.give, g = o => R.coopJudgeGive(W5, Object.assign({ now:30, dist:2, down:false, rounds:30 }, o));
  ok(g({}) === '' && g({ dist:Gv.r * Gv.rK + 1 }) === 'range' && g({ rounds:Gv.maxRounds + 1 }) === 'rounds' && g({ rounds:0 }) === 'rounds' && g({ down:true }) === 'down' && g({}) === '' && g({}) === 'rate' && g({ now:30 + 1 / Gv.perS + 0.01 }) === '' && R.coopAmmoCls(R.coopAmmoIdx('rifle')) === 'rifle' && R.coopAmmoIdx('nope') === -1,
    'a magazine thrown: taken from a standing man within reach, a sane number of rounds, ' + Gv.burst + ' at once at most; an ammunition class crosses as its index');
  ok(R.coopBlockP(true, 0.5) === 32768 && R.coopBlockP(true, 2) === 65535 && R.coopBlockP(true, -1) === 0 && R.coopBlockP(false, 12.4) === 12 && R.coopBlockP(false, 0.2) === 1 && R.coopBlockP(false, 1e9) === 65535, 'a damaged block crosses as what is left of it (16 bits) or as whole points of damage'); }
{ // our own men and the drones in the snapshot: the ALLY bit, a drone's kind and height, and what they cost
  const ES2 = P.NET_ESTATE, mk = (allies, drones) => { const enc = P.createSnapEncoder(), dec = P.createSnapDecoder(), f = P.makeNetFrame(), W = makeWorld(11); let bytes = 0, n = 0, last = null;
    for(let k = 1; k <= 100; k++){ const t = k * 50; W.step(t); P.netFrameReset(f, k, t); W.fill(f, t); P.netFramePlayer(f, hostMan(t)); P.netFramePlayer(f, guestMan(t));
      for(let i = 0; i < allies; i++){ const mv = i < allies / 2 ? t / 1000 * 3 : 0; P.netFrameAdd(f, 300 + i, i % 6, 10 + i * 2 + mv, 0, -40 + mv * 0.5, 0.3 * i + (mv ? t / 4000 : 0), ES2.ALLY | (i % 4) | (mv && (k % 6) < 2 ? ES2.FIRING : 0), 0.9); }
      for(let i = 0; i < drones; i++) P.netFrameAdd(f, 400 + i, COOP2.drone.kind0 + (i % COOP2.drone.kinds.length), Math.sin(t / 900 + i) * 30, 14 + i, Math.cos(t / 900 + i) * 30, t / 700, 0, 0.5);
      const b = enc.encode(f, dec.ackTick()); last = dec.decode(b); if(k > 1){ bytes += b.length; n++; } } return { per:Math.round(bytes / n), last }; };
  const base = mk(0, 0), with16 = mk(16, 2), g = with16.last; let allyN = 0, droneN = 0, hi = 0; for(let i = 0; i < g.n; i++){ const o = P.netFrameEnt(g, i); if(o.state & ES2.ALLY) allyN++; else if(o.kind >= COOP2.drone.kind0){ droneN++; hi = Math.max(hi, o.y); } }
  say(allyN === 16 && droneN === 2 && Math.abs(hi - 15) < 0.01 && with16.per > base.per && with16.per - base.per < 16 * 6 + 2 * 8, `80 moving enemies: ${base.per} B a delta snapshot; with 16 of our men (half of them running) and 2 drones: ${with16.per} B (+${with16.per - base.per} B; ${(base.per * COOP.snapHz / 1024).toFixed(1)} → ${(with16.per * COOP.snapHz / 1024).toFixed(1)} KB/s at ${COOP.snapHz} a second)`);
  report.allyBytes = { before:base.per, after:with16.per }; }

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
