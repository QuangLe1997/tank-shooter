// game/soldier-moves.js — Z336 THE SOLDIER ON HIS FEET MOVES LIKE ONE (soldier mode, off the ride): Space jumps (a spring off both feet, legs tucked, a
//   landing that gives at the knees); Shift held sprints; Alt / L is the combat roll drilled to get out of a line of fire — down onto the shoulder and over,
//   the way he is pushing (forward over the shoulder, to the side over the back), up on one knee with the rifle already shouldered, much harder to hit while
//   he is going over; and walking up to something knee-to-chest high in the way of his aim he takes cover behind it — down on a knee behind low cover,
//   standing behind higher — and lays the rifle on top of it to fire (combat/real-cav.js reads CV.cover for the rest).
import * as THREE from 'three';
import { CAV } from '../../config.js';
import { CV, S, afxLand, blockTop, blocksNear, graphRolls, heightAt, inBlock, sfx, soleAt, spawnPart } from '../hub.js';

const M = () => CAV.moves;
const _near = [], _ax = new THREE.Vector3();
// Space on foot: up
export function soldierJump(){ const p = S.player, now = performance.now() / 1000; if(!p || !p.cav || CV.mounted || CV.trans || CV.roll || CV.jump || CV.stance === 'prone' || CV.climb && CV.climb.ph !== 'top') return;   // (Z451 not on the face of a wall)
  CV.jump = { vy:M().jump.vy, y:0, t:0 }; CV.cover = null; sfx('whoosh', p.pos, 0.35); }
// Alt / L on foot: over the shoulder, the way he is pushing (or ahead)
export function soldierRoll(){ const p = S.player, now = performance.now() / 1000; if(!p || !p.cav || CV.mounted || CV.trans || CV.roll || CV.jump || now < (CV.rollCd || 0) || CV.climb && CV.climb.ph !== 'top') return;
  const C = M().roll, mv = Math.hypot(p.vel.x, p.vel.z), a = mv > 0.6 ? Math.atan2(p.vel.x, p.vel.z) : p.facing;
  CV.roll = { t:0, a, from:CV.stance }; CV.rollCd = now + C.cd / (p.loadK || 1);   /* SUPPLY 2 a heavy load: the roll comes back a little later (game/logistics.js) */ CV.cover = null; if(CV.stance === 'prone') CV.stance = CV.want = 'crouch';
  for(let n = 0; n < 5; n++) spawnPart(p.pos.x, heightAt(p.pos.x, p.pos.z) + 0.1, p.pos.z, (Math.random() - 0.5) * 1.5, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 1.5, { color:0xb8a888, size:0.5, life:0.6, smoke:true, grav:-0.5, drag:2, op:0.35 }); sfx('thud', p.pos, 0.4); }
// after the stance is settled: cover pulls him down behind it
export function footStance(p, dt, now){ const C = M().cover; CV.coverT = (CV.coverT || 0) - dt;
  if(CV.roll || CV.jump){ return; }
  if(CV.coverT <= 0){ CV.coverT = 0.12; CV.cover = findCover(p); }
  if(CV.cover && CV.want === 'stand' && CV.cover.h <= C.kneel) CV.stance = 'crouch'; }   // (low cover: down on a knee behind it; high cover: stood behind it)
// something solid just ahead along his aim, between knee and chest high, while he is slow — and not when he sprints off or turns away from it
function findCover(p){ const C = M().cover, mv = Math.hypot(p.vel.x, p.vel.z); if(mv > C.maxV || CV.stance === 'prone' || now() < CV.sprintUntil) return null;
  const a = p.aimSmoothed, gy = soleAt(p.pos.x, p.pos.z); let best = null;   // (Z451 up on a wall: from his soles there)
  for(const bl of blocksNear(p.pos.x, p.pos.z, C.reach + 3, _near)){ if(bl.ours || bl.ridge || !bl.hp && bl.hp !== undefined) continue;
    for(const d of C.probe){ const x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d; if(!inBlock(bl, x, z, 0.1)) continue;
      const h = blockTop(bl) - gy; if(h < C.h[0] || h > C.h[1]) break; if(!best || d < best.d) best = { d, h, top:gy + h, bl }; break; } }
  return best; }
const now = () => performance.now() / 1000;
// after the walk / run speed is set: a roll carries him, a jump keeps what he had
export function footMotion(p, dt){ const R = CV.roll, J = CV.jump;
  if(R){ const C = M().roll; R.t += dt / C.dur; const e = Math.min(1, R.t), v = C.v * (e < 0.8 ? 1 : (1 - e) / 0.2 * 0.8 + 0.2);
    p.vel.x = Math.sin(R.a) * v; p.vel.z = Math.cos(R.a) * v; p.defK = C.defK; p.radius = CAV.radius.prone;
    if(R.t >= 1){ CV.roll = null; CV.stance = 'crouch'; CV.rise = M().roll.rise; if(CV.want === 'prone') CV.want = 'crouch'; } }
  if(J && !J.climb){ const C = M().jump; J.t += dt; J.vy -= C.g * dt; J.y += J.vy * dt;
    if(J.y <= 0 && J.vy < 0){ CV.jump = null; CV.land = C.land; sfx('thud', p.pos, 0.35); afxLand(p.pos);   // AUDIO 2 both boots on this ground, the breath out of him
      for(let n = 0; n < 3; n++) spawnPart(p.pos.x, heightAt(p.pos.x, p.pos.z) + 0.05, p.pos.z, (Math.random() - 0.5) * 1.2, 0.3, (Math.random() - 0.5) * 1.2, { color:0xb8a888, size:0.4, life:0.5, smoke:true, grav:-0.5, drag:2, op:0.3 }); } }
  if(CV.rise > 0){ CV.rise -= dt; if(CV.rise <= 0 && CV.want === 'stand' && !CV.cover) CV.stance = 'stand'; else if(CV.rise > 0) CV.stance = 'crouch'; }
  if(CV.land > 0) CV.land -= dt; }
// the body: lifted off the ground in a jump; turned over about the line across his roll (pivot at his tucked middle) in a roll
export function footPose(G, p){ const R = graphRolls() ? null : CV.roll, J = CV.jump, C = M();   // (GRAPH 3 the motion graph's roll clip turns him over itself)
  if(!R && !J){ if(G.userData.mv){ G.userData.mv = false; G.position.set(0, 0, 0); G.quaternion.identity(); } return; }
  G.userData.mv = true; G.quaternion.identity(); G.position.set(0, 0, 0);
  if(J) G.position.y = Math.max(0, J.y);
  if(R){ const e = Math.min(1, R.t), k = e * e * (3 - 2 * e), th = k * Math.PI * 2, da = R.a - p.facing, dx = Math.sin(da), dz = Math.cos(da), h = C.roll.pivot, s = Math.sin(th), c = Math.cos(th);   // (in his own frame: the roll's way)
    G.quaternion.setFromAxisAngle(_ax.set(dz, 0, -dx), th);   // (the axis across the roll: his top goes over the way he rolls)
    G.position.set(-h * dx * s, h * (1 - c) - Math.abs(s) * C.roll.sink, -h * dz * s); } }   // (lying across the roll his back is on the ground, not over it)   // (turned about his tucked middle, h up, which stays put; the roll's speed carries it on)
// for the real soldier's pose and hold
export function footMoveState(){ return { roll:CV.roll ? Math.min(1, CV.roll.t) : -1, air:CV.jump ? 1 : 0, land:Math.max(0, CV.land || 0), cover:CV.cover ? CV.cover.top : null }; }
