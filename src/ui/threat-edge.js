// ui/threat-edge.js — BAL 3 A SHOOTER OFF THE SCREEN IS SHOWN AT ITS EDGE: a red chevron on the screen's rim toward every man off it who is taking aim at him or has just fired
//   at him (at most BAL.fair.maxN, the nearest first), and such a man is wide (his spread × spreadK) until he has been on the screen in the last onT s or shown at the rim for warnT s —
//   a round from someone the player could not know of mostly misses (actors/infantry.js fireRound reads offScreenK). Read every `every` s, never per frame; nothing allocated in the loop.
import * as THREE from 'three';
import { BAL } from '../../config.js';
import { S, SAFE, VIEW, camera, enemies, heightAt, inField, sfx } from '../hub.js';

const F = BAL.fair, _v = new THREE.Vector3(), _p = new THREE.Vector3(), EL = [], NEAR = [];
let wrap = null, at = 0, shown = 0;
function el(i){ if(EL[i]) return EL[i]; if(!wrap){ wrap = document.createElement('div'); wrap.id = 'threatEdge'; wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:13'; document.body.appendChild(wrap); }
  const e = document.createElement('i'); e.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;border-left:' + F.size * 0.45 + 'px solid transparent;border-right:' + F.size * 0.45 + 'px solid transparent;border-bottom:' + F.size + 'px solid ' + F.color + ';opacity:0.85;filter:drop-shadow(0 0 4px #000);display:none';
  wrap.appendChild(e); return (EL[i] = e); }
function hide(from){ for(let i = from; i < shown; i++) EL[i].style.display = 'none'; shown = Math.min(shown, from); }
// the rim point toward a world point off the screen (from the screen's centre, along where it lies — flipped when it is behind the lens)
function place(e, x, y, z, k){ _v.set(x, y, z).project(camera); let dx = _v.x, dy = _v.y; if(_v.z > 1){ dx = -dx; dy = -dy; } const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const m = F.margin, hw = VIEW.w / 2 - m, hh = VIEW.h / 2 - m, t = Math.min(hw / Math.max(1e-3, Math.abs(dx)), hh / Math.max(1e-3, Math.abs(dy))), sx = VIEW.w / 2 + dx * t, sy = VIEW.h / 2 - dy * t;
  e.style.transform = 'translate(' + (sx - F.size * 0.45) + 'px,' + (sy - F.size / 2) + 'px) rotate(' + Math.atan2(dx, dy) + 'rad)'; e.style.opacity = String(0.5 + 0.45 * k); e.style.display = ''; }
const onScreen = (x, y, z) => { _v.set(x, y, z).project(camera); return _v.z < 1 && Math.abs(_v.x) < 0.97 && Math.abs(_v.y) < 0.97; };
export function updateThreatEdge(dt, now){ const p = S.player; if(!F.on || !p || S.mode !== 'playing'){ if(shown) hide(0); return; } if(now < at) return; at = now + F.every;
  const r2 = F.r * F.r; let n = 0; NEAR.length = 0;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i], air = e.def.air; if(!(e.hp > 0) || !air && !(e.alert >= 2)) continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d2 = dx * dx + dz * dz; if(d2 > r2) continue;
    const y = air ? e.pos.y : heightAt(e.pos.x, e.pos.z) + 1.2; if(onScreen(e.pos.x, y, e.pos.z)){ e._onAt = now; e._edgeAt = 0; continue; }   // (an aircraft where it flies)
    const T = e._T, after = air || e.aimT > 0 || now - (e.shotAt || -9) < F.fireT || T && T.you && e.sees; if(!after || !air && T && !T.you){ e._edgeAt = 0; continue; }   // (after him: aiming, just fired, or he has him in sight; an aircraft in reach always)
    NEAR.push(e); }
  NEAR.sort((a, b) => ((a.pos.x - p.pos.x) ** 2 + (a.pos.z - p.pos.z) ** 2) - ((b.pos.x - p.pos.x) ** 2 + (b.pos.z - p.pos.z) ** 2));
  for(; n < NEAR.length && n < F.maxN; n++){ const e = NEAR[n]; if(!e._edgeAt) e._edgeAt = now; place(el(n), e.pos.x, e.def.air ? e.pos.y : heightAt(e.pos.x, e.pos.z) + 1.2, e.pos.z, e.aimT > 0 || now - (e.shotAt || -9) < F.fireT ? 1 : 0.55); }
  for(let i = n; i < NEAR.length; i++) NEAR[i]._edgeAt = 0;   // (past the shown few: not announced, still wide)
  shown = Math.max(shown, n); hide(n); }
// BAL 3 BEHIND HIM: the player faces only forward — the rear arc is the bearings more than rear.ang rad off the camera's heading. Nothing enters there within rear.r m
//   (frontYaw / rearArc / sideOf for every source: the director's flank, the waves' edge, a hatch, the ambush, the gunship, the paradrop); a man who is there anyway (a flanker who
//   walked round) cannot hit for rear.grace s after he got there (× rear.graceK), then stays × rear.k wide; his arrival is beeped once and he has his chevron on the rim
export function viewYaw(){ camera.getWorldDirection(_v); return Math.atan2(_v.x, _v.z); }
export function rearArc(x, z, r){ const p = S.player; if(!p || !F.rear.on) return false; const dx = x - p.pos.x, dz = z - p.pos.z; if(dx * dx + dz * dz > (r || F.rear.r) ** 2) return false;
  const d = Math.atan2(dx, dz) - viewYaw(); return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) > F.rear.ang; }
// a point behind him turned round him (same distance) to the nearest side he can see coming from — an entry that would have been there comes up there instead
export function sideOf(x, z){ const p = S.player; if(!p || !rearArc(x, z)) return null; const dx = x - p.pos.x, dz = z - p.pos.z, d = Math.hypot(dx, dz), f = viewYaw(), r = Math.atan2(dx, dz) - f, s = Math.atan2(Math.sin(r), Math.cos(r)) >= 0 ? 1 : -1;
  for(const k of [0, 0.25, 0.5]){ const a = f + s * (F.rear.ang - 0.2 - k), nx = p.pos.x + Math.sin(a) * d, nz = p.pos.z + Math.cos(a) * d; if(inField(nx, nz, 4)) return [nx, nz]; }
  return null; }
// a bearing (atan2(x, z)) somewhere he can see coming: the camera's heading ± the front and the sides
export function frontYaw(spread){ return viewYaw() + (Math.random() - 0.5) * 2 * Math.min(F.rear.ang - 0.15, spread == null ? F.rear.ang - 0.15 : spread); }
// how wide a man's round goes for being off the screen and unannounced, or behind him (1: as usual)
export function offScreenK(e, now){ if(!F.on) return 1; let k = now < SAFE.until ? BAL.start.spreadK : 1;   // (BAL 10 the calm first stretch)
  if(F.rear.on && rearArc(e.pos.x, e.pos.z, F.r)){ if(!e._rearAt){ e._rearAt = now; if(now - _beepAt > F.rear.beepGap){ _beepAt = now; sfx('beep'); } } k = Math.max(k, now - e._rearAt < F.rear.grace ? F.rear.graceK : F.rear.k); } else e._rearAt = 0;
  if(now - (e._onAt || -9) < F.onT || e._edgeAt && now - e._edgeAt >= F.warnT) return k; return Math.max(k, F.spreadK); }
let _beepAt = -9;
export function threatEdgeClear(){ hide(0); }
