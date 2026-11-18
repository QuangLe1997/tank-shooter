// combat/ballistics.js — Z228b A ROUND THAT FLIES LIKE ONE: velocity curves for every projectile.
//   · gun rounds (shells, autocannon, rifle/MG): out of the muzzle FAST (v0 × the gun's speed), then drag bleeds the speed away —
//     v(t) = vE + (v0−vE)·e^(−kt), with k and vE solved so the round still covers the aimed distance in the aimed time
//     (arcs land where they were lobbed, hit timing and difficulty unchanged — only the feel changes)
//   · rockets: the booster kicks them out slow, the motor lights and they surge — v(t) = vM − (vM−v0)·e^(−kt), vM solved the same way
//   · the look follows the speed: the hot core streak is longest at the muzzle and shortens as the round slows, the tracer thins;
//     a tank gun's APFSDS round sheds its sabot petals just past the muzzle, and a fast round trails a shock-vapour wake for its first metres
//   · hits are swept along the whole path the round covered this frame (a fast round can no longer skip through a man between frames)
import { BALLISTIC } from '../../config.js';
import { MOBILE, shellStretch, spawnPart } from '../hub.js';

const clamp=(v,a,b)=>Math.max(a, Math.min(b, v));
// set up a round's curve at launch; returns the launch speed
export function ballisticInit(b, o, sp){
  const B=BALLISTIC; b.bk=null; if(!(sp>0) || o.lockOn || o.smart || o.noBallistic) return sp;
  const rocket=!!(o.rocket || o.boost), D=o.arcDist || o.maxDist || 0;
  const T=clamp(D>0 ? D/sp : (rocket ? B.T.rocket : (o.life ? o.life*B.T.lifeK : B.T.def)), B.T.min, b.arc ? 0.9 : B.T.max);   // no aimed distance: match the speed over the round's usual engagement time
  b.bt=0; b.bsp=sp;
  if(rocket){ const R=B.rocket, k=R.k, v0=sp*R.v0, g=(1-Math.exp(-k*T))/k, vM=T>g+1e-3 ? clamp((sp*T - v0*g)/(T-g), sp, sp*R.cap) : sp*R.cap;
    b.bk='r'; b.bv0=v0; b.bvE=vM; b.bkk=k; return v0; }
  const G=B.gun, v0=sp*G.v0, k=G.decay/T, q=(1-Math.exp(-G.decay))/G.decay, vE=Math.max(sp*0.35, sp*(1-G.v0*q)/(1-q));
  b.bk='g'; b.bv0=v0; b.bvE=vE; b.bkk=k; return v0; }
// speed on the curve at the round's age
export function ballisticSpeed(b){ const e=Math.exp(-b.bkk*b.bt); return b.bk==='r' ? b.bvE-(b.bvE-b.bv0)*e : b.bvE+(b.bv0-b.bvE)*e; }
// advance the curve: rescale the round's velocity (direction kept — homing still steers it); returns the current speed (or 0)
export function ballisticStep(b, dt){ if(!b.bk) return 0; b.bt+=dt; const v=ballisticSpeed(b), s=Math.hypot(b.vx,b.vz)||1; b.vx*=v/s; b.vz*=v/s;
  const core=b.mesh.userData.core; if(b.bk==='g' && core && core.visible) core.scale.z=shellStretch(v);   // streak length follows the speed
  return v; }
// how fat the tracer runs for this speed (1 = the gun's nominal speed)
export function ballisticTrailK(b){ if(!b.bk) return 1; const v=Math.hypot(b.vx,b.vz); return clamp(0.72+0.38*v/b.bsp, 0.7, 1.35); }

// a tank gun's APFSDS round: the sabot splits into petals that peel away just past the muzzle
export function sabotDiscard(x, y, z, ang, v0){ const S=BALLISTIC.sabot, fx=Math.sin(ang), fz=Math.cos(ang), rx=fz, rz=-fx;
  for(let i=0;i<S.petals;i++){ const a=i/S.petals*6.283+Math.random()*0.6, ox=Math.cos(a), oy=Math.sin(a), out=S.out*(0.8+Math.random()*0.5), fw=v0*(0.32+Math.random()*0.12);
    spawnPart(x+fx*1.2, y, z+fz*1.2, fx*fw+rx*ox*out, oy*out*0.8+1.5, fz*fw+rz*ox*out, { color:0x3c3d36, color2:0x23241f, size:0.34, life:S.life+Math.random()*0.2, grav:-16, drag:2.2 }); } }
// the shock-vapour wake a very fast round drags for its first few metres
export function vaporWake(b, x, y, z){ const V=BALLISTIC.vapor; if(b.bk!=='g' || b.inf || b.bt>V.t || MOBILE) return; if((b._vw||0)>b.bt) return; b._vw=b.bt+V.every;
  spawnPart(x, y, z, b.vx*0.04, 0.15, b.vz*0.04, { color:0xe8ece8, size:0.75+Math.random()*0.35, life:0.26, smoke:true, grav:0, drag:4, grow:1.6, op:0.22 }); }

// swept hit: the point on this frame's path [(px,pz) → (x,z)] closest to (ex,ez) → written into out
export function sweepPoint(px, pz, x, z, ex, ez, out){ const dx=x-px, dz=z-pz, L2=dx*dx+dz*dz; let t=L2>1e-6 ? ((ex-px)*dx+(ez-pz)*dz)/L2 : 1; t=t<0?0:t>1?1:t; out.x=px+dx*t; out.z=pz+dz*t; return out; }

// enemy rockets / ATGMs (their own flight code): booster kick, then the motor
export function missileBoost(r, dt){ const E=BALLISTIC.enemyMissile; if(r._bm==null){ const k=E.k, T=Math.max(0.3, r.T||E.T),   /* a lobbed salvo passes its own flight time → still lands on the aim point */ v0=r.speed*E.v0, g=(1-Math.exp(-k*T))/k; r._bm=clamp((r.speed*T - v0*g)/(T-g), r.speed, r.speed*1.6); r._b0=v0; r._bt=0; }
  r._bt+=dt; return r._bm-(r._bm-r._b0)*Math.exp(-E.k*r._bt); }
