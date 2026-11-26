// campaign/entries.js — AI 2 NOBODY POPS INTO EXISTENCE. Every enemy soldier raised during a battle comes onto the field by a way the player can read:
//   (a) over the field's edge, out of the camera's frame and at least ENTRY.minD from him (edgeEntry; the waves ask for it) · (b) up out of a tunnel hatch —
//   the tunnel network's own, or a spider hole that opens for the occasion (hatchEntry: the lid swings up, the men climb out one at a time, each ENTRY.rise s
//   coming up out of the ground and unable to fire until he is out; world/tunnels.js spiderHole) · (c) out of a fortress gate, a barracks or a hut door, or
//   (d) down a helicopter's rope, under a parachute, off a fallen tower — those callers name their way in ('gate', 'door', 'rope', 'para', 'fall') and are
//   left alone. A caller that names nothing while a battle is on gets the hatch (entryCheck, called by spawnEnemy): the net under every source nobody
//   remembered — a base's reinforcements, a fortress's garrison waking, the relic's attackers, the general and his guards come up out of the ground, lid first.
import * as THREE from 'three';
import { ENTRY } from '../../config.js';
import { DICE, ENEMY_DEFS, S, TUN, UNDER, camera, fieldDepth, fieldEdgePoint, hatchNear, hatchOpen, heightAt, inField, makeSquad, poseSoldier, spawnEnemy, spiderHole, wetAt } from '../hub.js';

const _p = new THREE.Vector3(), PEND = [];
// is the point inside the camera's frame (a man's chest height; pad = a margin round the frame, in half-screens)
export function inCamView(x, z, pad){ _p.set(x, heightAt(x, z) + 1, z).project(camera); const m = 1 + (pad ?? ENTRY.pad); return _p.z > -1 && _p.z < 1 && Math.abs(_p.x) < m && Math.abs(_p.y) < m; }
// would the player see a man appear at (x, z): in the frame and nearer than seeD (past that a man is a speck in the haze), or simply too close to him
export function entrySeen(x, z){ const p = S.player; if(!p) return false; const d = Math.hypot(x - p.pos.x, z - p.pos.z); return d < ENTRY.nearD || d < ENTRY.seeD && inCamView(x, z); }
// (a) a point on the field's edge out of the frame and at least minD from him — near bearing a0 (field angle, as fieldEdgePoint) if it can be; null: nowhere
export function edgeEntry(a0, spread){ const p = S.player, E = ENTRY; let best = null, bs = 1e9;
  for(let k = 0; k < E.tries; k++){ const a = a0 == null ? Math.random() * 6.283 : a0 + (Math.random() - 0.5) * (spread || 1.3) * (1 + k * 0.4), q = fieldEdgePoint(a, E.edgeIn), x = q[0], z = q[1], d = p ? Math.hypot(x - p.pos.x, z - p.pos.z) : 60;
    if(d < E.minD || wetAt(x, z, 3) || inCamView(x, z)) continue; const s = d > 85 ? d - 85 : 0; if(s < bs){ bs = s; best = { x, z, how:'edge' }; } if(s === 0) break; }
  return best; }
// the field's edge on a bearing from the player (a = atan2(x, z)): the last point still inside, or null when the line leaves at once
export function edgeFrom(px, pz, a){ let ok = null; for(let d = 30; d < 420; d += 6){ const x = px + Math.sin(a) * d, z = pz + Math.cos(a) * d; if(fieldDepth(x, z) < 4) break; if(inField(x, z, 4)) ok = { x, z, d, how:'edge' }; } return ok; }
// (b) these men climb out of a hatch at (x, z), one every gap s: types = ['rifle', 'rpg', …]; opt.alert: they come up knowing where he is; opt.squad === false:
//   each on his own; opt.escort; opt.each(e): called on each man as he comes up. Returns the hatch.
export function hatchEntry(x, z, types, opt){ const now = performance.now() / 1000, E = ENTRY, H = hatchNear(x, z, E.reuse) || spiderHole(x, z, now);
  const g = { left:types.length, out:[], squad:!opt || opt.squad !== false, alert:!!(opt && opt.alert), escort:(opt && opt.escort) || null, each:(opt && opt.each) || null, tg:TUN.g };
  for(let i = 0; i < types.length; i++) PEND.push({ at:now + E.open + i * E.gap, type:types[i], H, g, i });
  hatchOpen(H, true, E.open + types.length * E.gap + E.rise); return H; }
// a man already made is put at the mouth of a hatch near him and comes up out of it (dur s; the hatch: the network's or a fresh spider hole)
export function entryRise(e, H){ const now = performance.now() / 1000, E = ENTRY; if(!H) H = hatchNear(e.pos.x, e.pos.z, E.reuse * 2) || spiderHole(e.pos.x, e.pos.z, now);
  const a = Math.random() * 6.283, r = H.kind === 'bunker' ? H.rad + 0.5 : 0.35, b = H.kind === 'bunker' ? H.a : a; e.pos.x = H.x + Math.sin(b) * r; e.pos.z = H.z + Math.cos(b) * r; e.facing = b;
  const t0 = Math.max(now, H.next || 0); H.next = t0 + E.gap; hatchOpen(H, false, t0 - now + E.rise + 0.6); return riseHere(e, t0 - now); }   // (one at a time: a second man waits below for the first to clear the rim)
// the climb itself, where he stands, starting wait s from now (a fortress's own basement hatch: world/fortress.js)
export function riseHere(e, wait){ const now = performance.now() / 1000 + (wait || 0), E = ENTRY; e.rise = { t0:now, dur:E.rise }; e.fireAt = Math.max(e.fireAt || 0, now + E.rise + E.hold); e.spawnHow = 'hatch';
  e.mesh.position.set(e.pos.x, heightAt(e.pos.x, e.pos.z) - E.depth * Math.max(1, e.mesh.scale.y), e.pos.z); return e; }
// spawnEnemy's net: a soldier raised during a battle whose caller named no way in comes up out of a hatch (the garrisons placed while a field is built, and
//   the underground base's own men, are simply at their posts)
export function entryCheck(e, how){ e.spawnHow = how || 'post'; if(how || !e.def.inf || S.mode !== 'playing' || DICE.building || UNDER.on || UNDER.x0 != null && e.pos.x > UNDER.x0) return; entryRise(e); }
// one step of the climb out (actors/infantry.js, before anything else he does): true while he is still coming up — below ground at first, hands up on the rim,
//   no move of his own, no shot; he can be hit
export function riseStep(e, dt, now){ const r = e.rise, E = ENTRY, k = (now - r.t0) / r.dur, u = e.mesh.userData;
  if(k >= 1){ e.rise = null; if(u.arms) u.arms.rotation.x = 0; e.fireAt = Math.max(e.fireAt || 0, now + E.hold); return false; }
  const q = k <= 0 ? 0 : k * k * (3 - 2 * k), gy = heightAt(e.pos.x, e.pos.z); e.mesh.position.set(e.pos.x, gy - E.depth * Math.max(1, e.mesh.scale.y) * (1 - q), e.pos.z); e.mesh.rotation.y = e.facing; poseSoldier(e.mesh, 'stand', dt);
  if(u.arms) u.arms.rotation.x = -2.3 * (1 - q) + Math.sin(now * 9) * 0.25 * (1 - q); e.aimT = 0; e.burstLeft = 0; e.r = 0.4; return true; }
// once a frame: the men whose turn it is to come up
export function updateEntries(dt, now){ for(let i = PEND.length - 1; i >= 0; i--){ const q = PEND[i]; if(now < q.at) continue; PEND.splice(i, 1); const g = q.g; g.left--;
    if(S.mode === 'playing' && g.tg === TUN.g && !q.H.sealed){ const e = spawnEnemy(q.type, q.H.x, q.H.z, 'hatch'); if(e){ if(g.alert) e.alert0 = 1; entryRise(e, q.H); g.out.push(e); if(g.each) g.each(e); } }
    if(g.left <= 0 && g.out.length){ if(g.squad) makeSquad(g.out, { escort:g.escort }); g.out = []; } } }
export function entriesPending(){ return PEND.length; }
export function isFoot(type){ return !!(ENEMY_DEFS[type] || ENEMY_DEFS.rifle).inf; }
