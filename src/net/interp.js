// net/interp.js — COOP 2 THE RECEIVING SIDE'S SNAPSHOT BUFFER: keeps the last few snapshots, draws the world a little in the past (now − delay) between two of them — positions straight, headings the short way round, a capped coast when snapshots stop, things appearing and going — PURE (runs in Node)
import { COOP } from '../../config.js';
import { NET_ES, NET_PS, makeNetFrame } from './protocol.js';

const Q = COOP.quant, LIM = COOP.limits, TAU = Math.PI * 2;
// what sample() fills (made once, reused): n entities in parallel arrays (metres, radians, hp 0–1), the players as plain objects, and the ids that
// became visible (born) / stopped being visible (gone) since the sample before
export function makeInterpOut(){ const C = LIM.entities, pl = []; for(let k = 0; k < LIM.players; k++) pl.push({ id:0, x:0, y:0, z:0, heading:0, aimYaw:0, aimPitch:0, vx:0, vz:0, stance:0, weapon:0, flags:0, hp:0, hpMax:0, mount:0 });
  return { n:0, id:new Int32Array(C), kind:new Uint8Array(C), x:new Float32Array(C), y:new Float32Array(C), z:new Float32Array(C), heading:new Float32Array(C), state:new Uint8Array(C), hp:new Float32Array(C),
    np:0, pl, nBorn:0, born:new Int32Array(C), nGone:0, gone:new Int32Array(C * 2), mode:'empty', t:0, k:0, tick:0, lead:0 }; }
// the short way from angle a to b on a circle of `steps`, as a signed step count
function arc(a, b, steps){ let d = (b - a) % steps; if(d > steps / 2) d -= steps; else if(d < -steps / 2) d += steps; return d; }

// opts: { delayMs, extrapMs, keep, teleportM, driftMs, offsetUp } (defaults COOP.interp)
export function createSnapInterp(opts){ const o = Object.assign({}, COOP.interp, opts), KEEP = Math.max(2, o.keep | 0), TP = o.teleportM * Q.pos, ring = [], recv = new Float64Array(KEEP);
  for(let k = 0; k < KEEP; k++) ring.push(makeNetFrame());
  let count = 0, head = 0, offset = 0, hasOff = false, prevN = 0; const prev = new Int32Array(LIM.entities), own = makeInterpOut();
  const at = k => ring[(head + k) % KEEP];   // k = 0 the oldest held … count − 1 the newest
  const I = { delayMs:o.delayMs, pushed:0, dropped:0,
    get count(){ return count; }, get offset(){ return offset; }, get newest(){ return count ? at(count - 1) : null; },
    // a decoded snapshot arrives (localNow = this machine's clock, ms). Its numbers are copied: the caller may reuse the frame. Out-of-order ones are dropped.
    push(f, localNow){ if(count && f.time <= at(count - 1).time){ I.dropped++; return false; }
      let s; if(count < KEEP) s = ring[(head + count++) % KEEP]; else { s = ring[head]; head = (head + 1) % KEEP; }
      s.tick = f.tick; s.time = f.time; s.n = f.n; s.np = f.np; s.ent.set(f.ent.subarray(0, f.n * NET_ES)); s.pl.set(f.pl.subarray(0, f.np * NET_PS)); I.pushed++;
      // the sender's clock minus ours, read off the snapshots that travelled fastest (a late one reads low): it eases up to a higher reading and sinks very
      // slowly otherwise, so a drifting clock is followed and the drawn time never jumps
      const off = f.time - localNow; if(!hasOff){ offset = off; hasOff = true; } else if(off >= offset) offset += (off - offset) * o.offsetUp; else offset -= Math.min(o.driftMs, offset - off); return true; },
    // the world at (localNow − delay) → out (default: one the buffer owns). out.mode: 'empty' · 'hold' (older than everything held) · 'lerp' · 'coast' (past the newest)
    sample(localNow, out){ out = out || own; out.nBorn = 0; out.nGone = 0;
      if(!count){ out.n = 0; out.np = 0; out.mode = 'empty'; out.lead = 0; diff(out); return out; }
      const t = localNow + offset - I.delayMs, N = at(count - 1); out.t = t; out.lead = N.time - t;
      // S = the snapshot whose things are drawn, T = the one they move towards (lerp) or came from (coast), kk = how far along that step
      let S = N, T = null, kk = 0, mode = 'coast';
      if(t < at(0).time){ S = at(0); mode = 'hold'; }
      else if(t < N.time){ for(let i = count - 2; i >= 0; i--) if(at(i).time <= t){ S = at(i); T = at(i + 1); break; } kk = (t - S.time) / (T.time - S.time); mode = 'lerp'; }
      else if(count > 1){ T = at(count - 2); kk = Math.min(t - N.time, o.extrapMs) / (N.time - T.time); }   // past the newest: go on along the last step, for a short while
      out.mode = mode; out.k = kk; out.tick = S.tick;
      // who is there = whoever is in the snapshot being left — or, coasting, in the newest. A thing only in the next one appears when that one is reached.
      const sE = S.ent, sn = S.n; let j = 0, n = 0;
      for(let i = 0; i < sn; i++){ const p = i * NET_ES, id = sE[p]; let x = sE[p + 2], y = sE[p + 3], z = sE[p + 4], h = sE[p + 5];
        if(T && kk){ const tE = T.ent, tn = T.n; while(j < tn && tE[j * NET_ES] < id) j++;
          if(j < tn && tE[j * NET_ES] === id){ const q = j * NET_ES; let dx = tE[q + 2] - x, dy = tE[q + 3] - y, dz = tE[q + 4] - z, dh = arc(h, tE[q + 5], Q.head); if(mode === 'coast'){ dx = -dx; dy = -dy; dz = -dz; dh = -dh; }
            if(dx * dx + dz * dz <= TP * TP){ x += dx * kk; y += dy * kk; z += dz * kk; h += dh * kk; } } }   // (a jump is not walked: it stays, then is there)
        out.id[n] = id; out.kind[n] = sE[p + 1]; out.x[n] = x / Q.pos; out.y[n] = y / Q.pos; out.z[n] = z / Q.pos; out.heading[n] = ((h % Q.head + Q.head) % Q.head) * TAU / Q.head; out.state[n] = sE[p + 6]; out.hp[n] = sE[p + 7] / 255; n++; }
      out.n = n;
      // the players, the same way (matched by id)
      const sP = S.pl; out.np = S.np;
      for(let i = 0; i < S.np; i++){ const p = i * NET_PS, P = out.pl[i], id = sP[p]; let x = sP[p + 1], y = sP[p + 2], z = sP[p + 3], h = sP[p + 4], ay = sP[p + 5], ap = sP[p + 6];
        if(T && kk) for(let m = 0; m < T.np; m++){ const q = m * NET_PS, tP = T.pl; if(tP[q] !== id) continue;
          let dx = tP[q + 1] - x, dy = tP[q + 2] - y, dz = tP[q + 3] - z, dh = arc(h, tP[q + 4], Q.aim), da = arc(ay, tP[q + 5], Q.aim), dp = tP[q + 6] - ap; if(mode === 'coast'){ dx = -dx; dy = -dy; dz = -dz; dh = -dh; da = -da; dp = -dp; }
          if(dx * dx + dz * dz <= TP * TP){ x += dx * kk; y += dy * kk; z += dz * kk; h += dh * kk; ay += da * kk; ap += dp * kk; } break; }
        P.id = id; P.x = x / Q.pos; P.y = y / Q.pos; P.z = z / Q.pos; P.heading = ((h % Q.aim + Q.aim) % Q.aim) * TAU / Q.aim; P.aimYaw = ((ay % Q.aim + Q.aim) % Q.aim) * TAU / Q.aim; P.aimPitch = Math.max(-1, Math.min(1, ap / 32767)) * (Math.PI / 2);
        P.vx = sP[p + 7] / Q.pos; P.vz = sP[p + 8] / Q.pos; P.stance = sP[p + 9]; P.weapon = sP[p + 10]; P.flags = sP[p + 11]; P.hp = sP[p + 12]; P.hpMax = sP[p + 13]; P.mount = sP[p + 14]; }
      diff(out); return out; },
    reset(){ count = 0; head = 0; hasOff = false; offset = 0; } };
  // born / gone against the sample before (both id lists are sorted)
  function diff(out){ let a = 0, b = 0; const n = out.n, ids = out.id;
    while(a < prevN || b < n){ const pa = a < prevN ? prev[a] : 65536, pb = b < n ? ids[b] : 65536; if(pa === pb){ a++; b++; } else if(pa < pb){ out.gone[out.nGone++] = pa; a++; } else { out.born[out.nBorn++] = pb; b++; } }
    for(let i = 0; i < n; i++) prev[i] = ids[i]; prevN = n; }
  return I; }
