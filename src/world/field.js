// world/field.js — Z106 FIELD BOUNDARY: the playable area is an irregular outline (radius per bearing around the Core) — bays, bulges,
//   a new shape each stage. Everything that moves or is placed asks inField() / clampField(); the fence follows the outline and the
//   ground beyond it rises into rocky highland.
import { FIELD, HOME_GAP, UNDERBASE } from '../../config.js';
import { ARENA, MOBILE, nearCrossing, wetAt } from '../hub.js';

// Z226 the underground base's state + its bounds (the field functions defer to them while you are down there) — lives here so it exists before the world is built
export const UNDER = { on:false, busy:false, x0:1e9, BX:0, W:UNDERBASE.W, D:UNDERBASE.D, gate:null, base:null, surf:[], sblocks:[], bmen:[], bblocks:[], turrets:[], targets:[], lamps:[], lights:[],
  cut:{ inf:0, veh:0 }, power:true, sqAt:0, tkAt:0, wx:'clear', hud:null, veil:null, back:[], told:false, cool:0 };

const inRect=(x,z,m)=>{ const U=UNDER, lx=x-U.BX; return (Math.abs(lx)<=U.W-m && Math.abs(z)<=U.D-m) || (Math.abs(lx)<=6.5-m && z>0 && z<=U.D+22-m); };
export function underActive(x){ return UNDER.on && x>UNDER.x0; }
export function underInside(x, z, m){ return inRect(x, z, m||0); }
export function underDepth(x, z){ const U=UNDER, lx=x-U.BX; return Math.min(U.W-Math.abs(lx), U.D-Math.abs(z)); }
export function underClamp(p, m){ const U=UNDER, mm=m||0; if(inRect(p.x,p.z,mm)) return false; const lx=p.x-U.BX;
  if(Math.abs(lx)<=6.5 && p.z>U.D-mm){ p.x=U.BX+Math.max(-6.5+mm, Math.min(6.5-mm, lx)); p.z=Math.min(U.D+22-mm, p.z); return true; }
  p.x=U.BX+Math.max(-U.W+mm, Math.min(U.W-mm, lx)); p.z=Math.max(-U.D+mm, Math.min(U.D-mm, p.z)); return true; }

export const FIELD_R = new Float32Array(FIELD.N);
export const FIELD_STATE = { ver:0, scale:1 };   // Z107 scale = custom-battle SPACE (fence encloses less of the arena)                  // bumps every time the outline changes (caches key on it)      // radius of the playable field at bearing i·2π/N  (bearing = atan2(z, x))
const TAU=Math.PI*2, R2=(r)=>r[0]+Math.random()*(r[1]-r[0]);
// distance from the centre to the inset square edge along bearing a (the outline never leaves the old square)
export function squareEdge(a){ const c=Math.abs(Math.cos(a)), s=Math.abs(Math.sin(a)); return (ARENA-6)/Math.max(c, s, 1e-6); }
// the outline's reference shape: half circle, half square → no right-angle corners, never outside the square
export function baseEdge(a){ return 0.5*(ARENA-6) + 0.5*squareEdge(a); }
// our spawn side is +z (bearing +π/2), the enemy objective side −z (−π/2)
function minFrac(a){ const ours=Math.cos(a-Math.PI/2), theirs=Math.cos(a+Math.PI/2);
  return Math.max(FIELD.minAny, ours>0.75 ? FIELD.minOurs : 0, theirs>0.85 ? FIELD.minTheirs : 0); }
export function genField(){ const N=FIELD.N, H=[]; for(let k=2;k<2+FIELD.harmonics;k++) H.push({ k, a:FIELD.amp*(0.4+Math.random()*0.6)*2/k, p:Math.random()*TAU });
  const bays=[]; const nb=Math.round(R2(FIELD.bays)); for(let i=0;i<nb;i++){ let a; for(let t=0;t<20;t++){ a=Math.random()*TAU-Math.PI; if(Math.cos(a-Math.PI/2)<0.6) break; }   // no deep bay into our spawn side
    bays.push({ a, d:R2(FIELD.bayDepth), w:R2(FIELD.bayWidth) }); }
  const f=new Float32Array(N);
  for(let i=0;i<N;i++){ const a=i/N*TAU-Math.PI; let k=FIELD.base; for(const h of H) k+=h.a*Math.sin(h.k*a+h.p);
    for(const b of bays){ let da=Math.abs(a-b.a); da=Math.min(da, TAU-da); k-=b.d*Math.exp(-(da*da)/(2*b.w*b.w)); }
    f[i]=Math.max(minFrac(a), Math.min(FIELD.max, k)); }
  for(let pass=0;pass<3;pass++){ const g=f.slice(); for(let i=0;i<N;i++) f[i]=(g[(i-1+N)%N]+g[i]*2+g[(i+1)%N])/4; }   // smooth the outline
  for(let i=0;i<N;i++){ const a=i/N*TAU-Math.PI; FIELD_R[i]=Math.max(minFrac(a), f[i])*baseEdge(a)*FIELD_STATE.scale; } FIELD_STATE.ver++; }
export function fieldR(a){ const N=FIELD.N; let u=((a+Math.PI)/TAU)*N; u=((u%N)+N)%N; const i=u|0, t=u-i; return FIELD_R[i]*(1-t)+FIELD_R[(i+1)%N]*t; }
export function fieldRAt(x, z){ return fieldR(Math.atan2(z, x)); }
// how far inside the field (x,z) is — negative outside
export function fieldDepth(x, z){ if(underActive(x)) return underDepth(x, z); return fieldRAt(x, z)-Math.hypot(x, z); }   // Z226 below ground: the base's own walls
export function inField(x, z, m){ if(underActive(x)) return underInside(x, z, m); return fieldDepth(x, z) >= (m||0) && !wetAt(x, z, Math.min(30, Math.max(2, m||0))) && !nearCrossing(x, z, m); }   // Z139 nothing is placed in a river (Z405 nor across a bridge's or a ford's way)
// pull a position {x,z} back inside (m = margin from the fence); true if it had to move
export function clampField(p, m){ if(underActive(p.x)) return underClamp(p, m); const d=Math.hypot(p.x, p.z), R=fieldRAt(p.x, p.z)-(m||0); if(d<=R || d<1e-6) return false; const k=Math.max(0,R)/d; p.x*=k; p.z*=k; return true; }
export function clampFieldXZ(x, z, m){ const p={ x, z }; clampField(p, m); return [p.x, p.z]; }
// a point on the outline at bearing a, `inset` metres inside the fence
export function fieldEdgePoint(a, inset){ const r=fieldR(a)-(inset||0); return [Math.cos(a)*r, Math.sin(a)*r]; }
// the outline as a closed polyline, resampled every `step` metres: [{x,z,nx,nz}] (n = outward normal)
export function fieldPath(step, inset){ const N=720, raw=[]; for(let i=0;i<N;i++){ const a=i/N*TAU-Math.PI, r=fieldR(a)-(inset||0); raw.push([Math.cos(a)*r, Math.sin(a)*r]); }
  const out=[]; let acc=0; for(let i=0;i<N;i++){ const [x0,z0]=raw[i], [x1,z1]=raw[(i+1)%N], L=Math.hypot(x1-x0,z1-z0);
    while(acc<=L){ const u=acc/L, x=x0+(x1-x0)*u, z=z0+(z1-z0)*u, tx=(x1-x0)/L, tz=(z1-z0)/L; out.push({ x, z, tx, tz, nx:tz, nz:-tx }); acc+=step; } acc-=L; }
  // outward normal: make it point away from the centre
  for(const q of out){ if(q.nx*q.x+q.nz*q.z<0){ q.nx=-q.nx; q.nz=-q.nz; } }
  return out; }
// a coarse outline for maps (cached per outline version)
let _ol=null, _olv=-1; export function fieldOutline(){ if(_olv!==FIELD_STATE.ver){ _ol=fieldPath(6, 0).map(q=>[q.x,q.z]); _olv=FIELD_STATE.ver; } return _ol; }
genField();

// Z234 HOME GROUND: open ground (m) between our citadel's wall and a site of radius R at (x,z) — and the test every enemy installation must pass
export function homeGap(x, z, R){ return Math.hypot(x, z)-(R||0)-HOME_GAP.wall; }
export function homeClear(x, z, R, small, k){ const H=HOME_GAP, g=(small ? (MOBILE?H.smallMobile:H.small) : (MOBILE?H.gapMobile:H.gap))*(k??1), sp=MOBILE?H.spawnMobile:H.spawn;   // k < 1: a crowded field relaxes the gap (never below HOME_GAP.minK)
  return homeGap(x, z, R) >= g && Math.hypot(x, z-ARENA*0.55)-(R||0) >= sp; }
