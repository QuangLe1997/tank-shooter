// actors/gun-feel.js — GUN 3 THE FEEL OF A SHOT (config GUNFEEL.shot / .cycle; the soldier's own guns — combat/soldier-fire.js, actors/real-cav.js holdReal):
//   · a burst CLIMBS THEN SETTLES: on top of each shot's own kick (holdReal's spring, per gun: actors/gun-fit.js gunRecoil) the muzzle rides up round
//     after round, and after a moment he takes most of it back; let go, it drops a touch under the aim and comes home (shotSeen, burstClimb)
//   · the first rounds of a burst land TIGHTER than the tenth: the gun's own spread × burstSpread (0.6 for the first three, 1.2 from the tenth)
//   · the camera's kick is a burst's first rounds; the rounds after shove it less (camKick) — the view settles as his shoulder does
//   · the flash lies along the bore as the gun is pitched (boreNow), the spent case leaves the EJECTION PORT on the gun's own right side, thrown to his
//     right and up (throwCase; a belt gun drops its link with it) — it used to start half a metre behind the muzzle, 60 cm over the ground even lying down
//   · a gun worked by hand keeps its case until he works it: the 12.7's bolt (the right hand off the grip — up, back, forward, down) and the shotgun's
//     pump (the left hand back and forward) after every shot, the case thrown at the stroke (shotCycle)
//   · a hit ANSWERS: four ticks round the crosshair and a click; a kill, a longer red mark and a lower click (hitConfirm)
import * as THREE from 'three';
import { GUNFEEL, GUNHOLD } from '../../config.js';
import { CO, coopDmgNote, CV, FIT, MOBILE, S, VIEW, XH, camera, ejectBrass, sfx, spawnPart } from '../hub.js';

const V3 = () => new THREE.Vector3(), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }, seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);

// ---- pure: the nth round of a burst (1 = the first) ----
export function burstSpread(n){ const B = GUNFEEL.shot.bloom; return B.first + (B.max - B.first) * clamp((n - B.tight) / (B.full - B.tight), 0, 1); }
export function camKick(n){ const C = GUNFEEL.shot.cam; return n <= C.after ? C.first : C.auto; }
// which round of a burst this is: a pause longer than bloom.reset starts a new one (p = the player; kept on him)
// MODE 3 what the result cards read (campaign/mode-run.js): n — his trigger pulls · hit — the pulls that struck somebody (a blast of pellets counts once) · at — the last one
export const SHOTS = { n:0, hit:0, at:-9, killAt:-9 };   // (FEEL 4 killAt: his own round's last kill — audio/banter.js says "Hạ một!" only then)
export function burstRound(p, now){ SHOTS.n++; const B = GUNFEEL.shot.bloom; p._bN = now - (p._bT || -9) > B.reset ? 1 : (p._bN || 0) + 1; p._bT = now; return p._bN; }

// ---- the muzzle's climb over a burst (holdReal) ----
// a new shot was seen: rc = holdReal's recoil state, KK = this gun's kick; the clock the bolt / the pump is worked by
export function shotSeen(R, rc, KK, p, nowS){ const C = GUNFEEL.shot.climb; R.shotAt = nowS; R.shotCd = Math.max(0.08, p.fireAt - nowS); rc.h = Math.min(C.cap, (rc.h || 0) + KK.kick[1] * C.per); rc.hot = nowS; }
// every frame → the climb to add to the gun's pitch (rad): what has built up less what he has taken back
export function burstClimb(rc, nowS, dt){ if(!rc.h && !rc.c) return 0; const C = GUNFEEL.shot.climb, firing = nowS - (rc.hot || 0) < C.gap;
  rc.h *= Math.exp(-dt * (firing ? C.hold : C.rest)); rc.c = (rc.c || 0) + (rc.h * C.comp - (rc.c || 0)) * Math.min(1, dt / C.lag);
  if(rc.h < 1e-4 && Math.abs(rc.c) < 1e-4){ rc.h = rc.c = 0; return 0; } return rc.h - rc.c; }

// ---- the gun as it lies now: its bore's pitch, for the flash; null when he holds no fitted weapon ----
const _bn = { met:null, k:null, pit:0 };
export function boreNow(){ const R = CV.real, k = R && R.pup && R.armK, met = k && R.arms && R.arms._metric && R.arms._metric[k]; if(!met || !met.visible) return null;
  met.updateWorldMatrix(true, false); const e = met.matrixWorld.elements, L = Math.hypot(e[0], e[1], e[2]) || 1; _bn.met = met; _bn.k = k; _bn.pit = Math.asin(clamp(-e[1] / L, -1, 1)); return _bn; }
// ---- the spent case out of the ejection port ----
const _p = V3();
export function throwCase(met, k, heavy){ const E = GUNFEEL.shot.eject, f = FIT[k], g = f || GUNHOLD[k] || GUNHOLD.ar, len = met.userData.len, e = met.matrixWorld.elements;
  const px = (f && f.magDrop && f.bolt ? f.bolt[0] : g.grip[0] - E.ahead / len) * len; _p.set(px, (f ? f.bore : 0.02) + E.up, -E.side).applyMatrix4(met.matrixWorld);   // (over the magazine well, on the gun's right side: −z)
  const r = E.v[0] + Math.random() * E.v[1], u = E.v[2] + Math.random() * E.v[3], vx = -e[8] * r + e[4] * u + e[0] * E.back, vy = -e[9] * r + e[5] * u + e[1] * E.back, vz = -e[10] * r + e[6] * u + e[2] * E.back;
  ejectBrass(_p.x, _p.y, _p.z, vx, vy, vz, heavy ? 'mg' : 'rifle'); if(E.link.includes(k)) ejectBrass(_p.x, _p.y - 0.02, _p.z, vx * 0.6, vy * 0.5, vz * 0.6, 'link'); }
// a round was fired (combat/soldier-fire.js): the case — at once, or kept for the bolt / the pump — and the wisp of smoke at the muzzle
export function shotCase(B, g, x, y, z, a0){ const E = GUNFEEL.shot.eject, R = CV.real, heavy = g.dmg * (g.frags || 1) >= 40;
  if(!E.none.includes(B.k)){ if(GUNFEEL.cycle[B.k] && !CV.mounted && R) R.caseDue = heavy ? 2 : 1; else throwCase(B.met, B.k, heavy); }
  if(!g.supp && (!MOBILE || Math.random() < 0.4)){ const fx = Math.sin(a0), fz = Math.cos(a0); spawnPart(x + fx * 0.15, y + 0.02, z + fz * 0.15, fx * 0.8, 0.35, fz * 0.8, { color:0xc9c4ba, size:heavy ? 0.6 : 0.42, life:0.7 + Math.random() * 0.4, smoke:true, grav:0.5, drag:2.2, grow:2.2, op:heavy ? 0.32 : 0.22 }); } }

// ---- a gun worked by hand after every shot (holdReal, on his feet, not reloading) ----
const _cy = { on:false, rOn:false, r:V3(), dx:0 }, _h0 = V3(), _h1 = V3(), _h2 = V3();
const mix = (out, a, b, u) => out.copy(a).lerp(b, smooth(u));
// FR = the gun's frame; wr = the right hand's place on the grip → { on, rOn + r: the right hand's place (the bolt), dx: the left palm's slide back along the gun (the pump) }
export function shotCycle(R, g, len, FR, wr, nowS){ const C = GUNFEEL.cycle[R.armK], O = _cy; O.on = O.rOn = false; O.dx = 0; if(!C || !R.shotAt) return O;
  const c = ((nowS - R.shotAt) / (R.shotCd || 1) - C.at) / C.dur;
  if(c >= C.eject && R.caseDue){ const met = R.arms._metric && R.arms._metric[R.armK]; if(met) throwCase(met, R.armK, R.caseDue > 1); R.caseDue = 0; sfx(C.snd); }   // (the stroke: out it goes)
  if(c < 0 || c > 1) return O; const A = GUNFEEL.reload.at; O.on = true;
  if(C.hand === 'R'){ const b = g.bolt || GUNHOLD.bolt; _h0.set(b[0] * len, b[1], 0).applyQuaternion(FR.q).add(FR.p).addScaledVector(FR.z, -A.handle[0]).addScaledVector(FR.y, A.handle[1]).addScaledVector(FR.x, 0.03);
    _h1.copy(_h0).addScaledVector(FR.y, A.lift); _h2.copy(_h1).addScaledVector(FR.x, A.rack + 0.03); O.rOn = true;
    if(c < 0.2) mix(O.r, wr, _h0, c / 0.2); else if(c < 0.32) mix(O.r, _h0, _h1, seg(c, 0.2, 0.32)); else if(c < 0.5) mix(O.r, _h1, _h2, seg(c, 0.32, 0.5)); else if(c < 0.68) mix(O.r, _h2, _h1, seg(c, 0.5, 0.68));
    else if(c < 0.8) mix(O.r, _h1, _h0, seg(c, 0.68, 0.8)); else mix(O.r, _h0, wr, seg(c, 0.8, 1)); }
  else O.dx = A.pump * (c < 0.45 ? smooth(c / 0.45) : 1 - smooth(seg(c, 0.45, 0.9)));
  return O; }

// ---- a hit answers ----
let _hm = null, _hmT = 0, _hmAt = -9; const _hv = V3();
function mark(){ if(_hm || typeof document === 'undefined') return _hm; const H = GUNFEEL.shot.hit, s = H.size, a = s * 0.22, b = s * 0.46, ln = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  const e = document.createElement('div'); e.id = 'xhairHit'; e.style.cssText = `position:fixed;left:0;top:0;width:${s}px;height:${s}px;margin:${-s / 2}px 0 0 ${-s / 2}px;pointer-events:none;z-index:7;display:none;will-change:transform,opacity`;
  e.innerHTML = `<svg viewBox="${-s / 2} ${-s / 2} ${s} ${s}" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" style="filter:drop-shadow(0 0 1.5px rgba(0,0,0,.9))">${ln(-b, -b, -a, -a)}${ln(b, -b, a, -a)}${ln(-b, b, -a, a)}${ln(b, b, a, a)}</svg>`;
  document.body.appendChild(e); return (_hm = e); }
// one of his rounds struck an enemy (combat/lock-on.js): the mark at the crosshair (the mouse's own, or where the pad's is drawn), the click — kill = it dropped him
export function hitConfirm(kill){ if(CO.ai) coopDmgNote(0, 0);   /* COOP 9 the host's own hits, for the director's "who hurts them most" */ const H = GUNFEEL.shot.hit, now = performance.now() / 1000; if(now - SHOTS.at > 0.02){ SHOTS.hit++; SHOTS.at = now; } if(kill) SHOTS.killAt = now; if(!kill && now - _hmAt < H.gap) return; _hmAt = now; const e = mark(); if(!e) return;
  let x = XH.mx, y = XH.my; if(XH.src !== 'mouse' || x < 0){ if(!S.aimPoint) return; _hv.copy(S.aimPoint).project(camera); if(_hv.z > 1) return; x = (_hv.x + 1) / 2 * VIEW.w; y = (1 - _hv.y) / 2 * VIEW.h; }
  e.style.color = kill ? H.col[1] : H.col[0]; e.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${kill ? H.killK : 1})`; e.style.transition = 'none'; e.style.opacity = '1'; e.style.display = 'block';
  const ms = kill ? H.killMs : H.ms; clearTimeout(_hmT); void e.offsetWidth; e.style.transition = `opacity ${ms}ms ease-out`; e.style.opacity = '0'; _hmT = setTimeout(() => { e.style.display = 'none'; }, ms + 30);
  sfx(kill ? 'killTick' : 'hitTick'); }
