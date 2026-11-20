// game/ride-wear.js — Z303 THE RIDE WEARS OUT: the xe ôm / ba gác / bán tải has its own health. Hits taken while riding (a share of the soldier's) and
// crashes wear it down: grey smoke from the engine, then black smoke, a coughing engine and a limp (slower); at nothing the engine dies — the soldier
// steps off, the driver squats by the engine and hammers at it, then it fires up again at part health and he waits for you.
// The bike never chases you: on foot you go where you like; G climbs back on when you are near, or calls the ride over when you are not.
import * as THREE from 'three';
import { XEOM } from '../../config.js';
import { CV, S, floatText, sfx, spawnPart } from '../hub.js';

const _p = new THREE.Vector3();
const W = () => XEOM.wear;
export function rideHpMax(H){ return W().hp[H && H.bike] || 140; }
export function rideHealth(H){ return H && H.bike ? Math.max(0, H.hp ?? rideHpMax(H)) / rideHpMax(H) : 1; }
// how fast it can still go: a coughing engine has lost its top end
export function rideSpeedK(H){ return H && H.bike && rideHealth(H) < W().limp ? W().limpK : 1; }
const say = (t, c) => { const p = S.player; if(p) floatText(t, c, p.pos, 14); };
export function rideWear(H, dmg){ if(!H || !H.bike || H.broken || !(dmg > 0)) return; if(H.hp == null) H.hp = rideHpMax(H);
  const k0 = rideHealth(H); H.hp = Math.max(0, H.hp - dmg); const k = rideHealth(H);
  if(k0 >= W().smoke && k < W().smoke) say('XE BỐC KHÓI!', '#ffcf5a');
  if(k0 >= W().limp && k < W().limp) say('XE HỤT HƠI — SẮP CHẾT MÁY!', '#ff9a4a');
  if(k <= 0) rideBreak(H); }
export function rideBreak(H){ if(!H || H.broken) return; H.broken = true; sfx('clang');
  say('XE CHẾT MÁY! BÁC TÀI ĐANG SỬA', '#ff6a4a');
  const D = H.drv; if(D && D.ok && D.state === 'ride'){ D.state = 'fix'; D.t2 = 0; }
  if(CV.H === H){ CV.call = false; if(CV.mounted && !CV.trans) CV.trans = { k:'off', t:0 }; } }   // the soldier steps off (not thrown)
export function rideFixed(H){ H.broken = false; H.hp = rideHpMax(H) * W().fixHp; sfx('whoosh'); say('NỔ MÁY RỒI! LÊN XE ĐI CON (G)', '#9be04a'); }
export function rideReset(H){ if(!H || !H.bike) return; H.hp = rideHpMax(H); H.broken = false; const D = H.drv; if(D && D.state === 'fix'){ D.state = 'ride'; D.fixK = 0; } }
// smoke off a worn engine: grey wisps, then black, then a column from a dead one
export function rideSmoke(H, dt){ if(!H || !H.body || typeof window === 'undefined') return; const k = rideHealth(H), w = W(); if(k >= w.smoke && !H.broken) return;
  const heavy = H.broken ? 1 : k < w.limp ? 0.6 : 0.2; H.smokeAcc = (H.smokeAcc || 0) + (H.broken ? 12 : k < w.limp ? 8 : 4) * dt;   // puffs per second, metered (never thinned away)
  while(H.smokeAcc >= 1){ H.smokeAcc -= 1; H.body.localToWorld(_p.fromArray(w.engine[H.bike] || [0, 0.2, 0]));
    spawnPart(_p.x + (Math.random() - 0.5) * 0.15, _p.y, _p.z + (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.5, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.5,
      { color:heavy > 0.5 ? 0x1e1a16 : 0x7a7670, size:0.7 + heavy * 1.1, grow:1.2 + heavy * 1.8, life:1.6 + heavy * 1.8, grav:0.35, drag:0.9, smoke:true, op:0.4 + heavy * 0.2, keep:true }); } }
