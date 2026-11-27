// game/ride-wear.js — Z303 THE RIDE WEARS OUT: the xe ôm / ba gác / bán tải has its own health. Hits taken while riding (a share of the soldier's) and
// crashes wear it down: grey smoke from the engine, then black smoke, a coughing engine and a limp (slower); at nothing the engine dies — the soldier
// steps off, the driver squats by the engine and hammers at it, then it fires up again at part health and he waits for you.
// The bike never chases you: on foot you go where you like; G climbs back on when you are near, or calls the ride over when you are not.
import * as THREE from 'three';
import { XEOM } from '../../config.js';
import { CV, DRIVER_BREAK, DRIVER_RANT, S, driverBack, driverStall, rideNote, sfx, spawnPart } from '../hub.js';

const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
const W = () => XEOM.wear;
export function rideHpMax(H){ return W().hp[H && H.bike] || 140; }
export function rideHealth(H){ return H && H.bike ? Math.max(0, H.hp ?? rideHpMax(H)) / rideHpMax(H) : 1; }
// how fast it can still go: a coughing engine has lost its top end
export function rideSpeedK(H){ if(H && H.onBreak) return 0; return H && H.bike && rideHealth(H) < W().limp ? W().limpK : 1; }   // (Z363 pulled over for the driver's break)
const say = (t, c) => rideNote(t, c);   // HUDCLEAN 1 in the ride's chip at the lower left, not over the soldier
export function rideWear(H, dmg){ if(!H || !H.bike || H.broken || !(dmg > 0)) return; if(H.hp == null) H.hp = rideHpMax(H);
  const k0 = rideHealth(H); H.hp = Math.max(0, H.hp - dmg); const k = rideHealth(H);
  if(k0 >= W().smoke && k < W().smoke) say('XE BỐC KHÓI', '#ffcf5a');
  if(k0 >= W().limp && k < W().limp) say('XE HỤT HƠI', '#ff9a4a');
  if(k <= 0) rideBreak(H); }
export function rideBreak(H){ if(!H || H.broken) return; H.broken = true; sfx('clang');
  say('XE CHẾT MÁY · ĐANG SỬA', '#ff6a4a');
  const D = H.drv; if(D && D.ok && D.state === 'ride') driverStall(H);   // Z361 he takes it badly first: the kick-start, a boot to the tyre, a row with the soldier (actors/driver-rant.js) — then the repair
  if(CV.H === H){ CV.call = false; if(CV.mounted && !CV.trans) CV.trans = { k:'off', t:0 }; } }   // the soldier steps off (not thrown)
export function rideFixed(H){ H.broken = false; H.hp = rideHpMax(H) * W().fixHp; sfx('whoosh'); say('NỔ MÁY RỒI!', '#9be04a'); }   // (Z363 then he rides over to pick the soldier up: game/cavalry.js onBack)
export function rideReset(H){ if(!H || !H.bike) return; H.hp = rideHpMax(H); H.broken = false; const D = H.drv; if(D && D.state === 'fix'){ D.state = 'ride'; D.fixK = 0; } else if(D && (D.state === 'stall' || D.state === 'pull' || DRIVER_RANT.has(D.state) || DRIVER_BREAK.has(D.state))) driverBack(H); H.onBreak = false; }
// Z363 THE EXHAUST of an old, oil-burning two-wheeler: while the engine runs (the driver riding, or pulled up and idling) blue-grey puffs out of the
//   muffler (XEOM.exhaust), thin at idle, thicker and quicker with the speed, a dark gout when he opens the throttle; carried back off the pipe
export function rideExhaust(H, dt){ const X = XEOM.exhaust, D = H && H.drv; if(!X || !H.body || !X[H.bike] || typeof window === 'undefined' || !D || H.broken) return;
  if(D.state !== 'ride' && D.state !== 'mount' && D.state !== 'pull') return; const sp = Math.min(1, Math.abs(H.v || 0) / 9), thr = Math.max(0, D.thr || 0);
  H.exAcc = (H.exAcc || 0) + (X.rate[0] + sp * X.rate[1] + thr * X.rate[2]) * dt; if(H.exAcc < 1) return; H.exAcc -= Math.floor(H.exAcc);
  H.body.localToWorld(_p.fromArray(X[H.bike])); const q = H.body.getWorldQuaternion(_q), b = _d.set(0, 0, -1).applyQuaternion(q), dark = thr > 0.35;
  spawnPart(_p.x, _p.y, _p.z, b.x * X.v + (Math.random() - 0.5) * 0.3, 0.25 + Math.random() * 0.25, b.z * X.v + (Math.random() - 0.5) * 0.3,
    { color:dark ? X.dark : X.col, size:X.size * (0.8 + sp * 0.6 + thr * 0.8), grow:2.2, life:X.life * (0.7 + sp * 0.5), grav:0.25, drag:1.6, smoke:true, op:X.op * (0.6 + sp * 0.5 + thr), keep:true }); }   // (keep: a steady trickle, never thinned away)
// smoke off a worn engine: grey wisps, then black, then a column from a dead one
export function rideSmoke(H, dt){ if(!H || !H.body || typeof window === 'undefined') return; const k = rideHealth(H), w = W(); if(k >= w.smoke && !H.broken) return;
  const heavy = H.broken ? 1 : k < w.limp ? 0.6 : 0.2; H.smokeAcc = (H.smokeAcc || 0) + (H.broken ? 12 : k < w.limp ? 8 : 4) * dt;   // puffs per second, metered (never thinned away)
  while(H.smokeAcc >= 1){ H.smokeAcc -= 1; H.body.localToWorld(_p.fromArray(w.engine[H.bike] || [0, 0.2, 0]));
    spawnPart(_p.x + (Math.random() - 0.5) * 0.15, _p.y, _p.z + (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.5, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.5,
      { color:heavy > 0.5 ? 0x1e1a16 : 0x7a7670, size:0.7 + heavy * 1.1, grow:1.2 + heavy * 1.8, life:1.6 + heavy * 1.8, grav:0.35, drag:0.9, smoke:true, op:0.4 + heavy * 0.2, keep:true }); } }
