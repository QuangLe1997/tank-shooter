// game/update.js — the camera that follows the soldier, the enemy vehicles' rigs, Vietnamese label helpers (no-tanks: the tank's drive / aim / fire is gone)
import * as THREE from 'three';
import { CAM_AUTO, CAM_STYLE, CAM_FEEL, CAM_ROOM, SHAKE, CLIMB, VISLOOK } from '../../config.js';
import { BIOME_VI, CV, FORTS, MOBILE, SEE, seeSweep, PLAYER, PROFILE, S, camera, coreBeamBlocked, enemies, fortBeamBlocked, gradePass, heightAt, sightToBuildings, sightToRocks, camRocksStale, underActive, crushables, trunkR, camAimA, steadyCam, climbing, armPull, armReset, FBOSS, core } from '../hub.js';

// ----------------------------- UPDATE -----------------------------
export function biomeVi(n){ return BIOME_VI[n]||n; }
export function wrapAngle(a){ return Math.atan2(Math.sin(a), Math.cos(a)); }
// camera follow with aim lookahead
// lower, closer 3rd-person angle (was a high top-down); pulls back a touch on dash
export const camOff = new THREE.Vector3(0, MOBILE?8.6:9.4, MOBILE?16.2:18.2);   // base offset; S.zoom scales it, S.camYaw rotates it (player camera controls) · Z184 set from the chosen CAM_STYLE every frame
export function camStyle(){ let k; try{ k=PROFILE.camStyle; }catch(e){} return CAM_STYLE[k] || CAM_STYLE.cine; }   // (the boot backdrop frames run before the profile module is evaluated)
// Z184 the camera the player gets: the style, then their own tuning on top (pitch°, distance ×, field of view°, look-ahead ×)
export function camParams(){ const C=camStyle(), o=MOBILE?C.offM:C.off; let t=null; try{ t=PROFILE.camTune; }catch(e){}
  const d0=Math.hypot(o[1],o[2]), p0=Math.atan2(o[1],o[2])*57.29578;
  return { pitch: t&&t.pitch!=null ? t.pitch : p0, dist: d0*(t&&t.distK!=null ? t.distK : 1), fov: t&&t.fov!=null ? t.fov : C.fov,
    ahead: (MOBILE?C.aheadM:C.ahead)*(t&&t.aheadK!=null ? t.aheadK : 1), lookY:C.lookY, speedFov:C.speedFov, p0, d0, fov0:C.fov, ahead0:(MOBILE?C.aheadM:C.ahead) }; }
export function applyCamStyle(){ const P=camParams(), r=P.pitch/57.29578; camOff.set(0, P.dist*Math.sin(r), P.dist*Math.cos(r)); return P; }
export const _camOff = new THREE.Vector3(), _camUP = new THREE.Vector3(0,1,0);
export const camTarget = new THREE.Vector3();
export const camLook = new THREE.Vector3();
export const camBase = new THREE.Vector3(); export let _camT = -1; const _camWant = new THREE.Vector3();
// Z110 AUTO CAMERA: how much wider the fight wants the view right now (0 … CAM_AUTO.max), on top of the zoom the player picked
export let _camAutoAt=0, _camAutoWant=0;
export function camAutoPull(p){ const A=CAM_AUTO, px=p.pos.x, pz=p.pos.z, R2=A.nearR*A.nearR; let n=0, k=0;
  k += Math.min(1, Math.hypot(p.vel.x, p.vel.z)/PLAYER.maxSpeed) * A.speedK;                                  // speed: see what you're driving into
  for(const e of enemies){ if(e.guard) continue; const dx=e.pos.x-px, dz=e.pos.z-pz; if(dx*dx+dz*dz<R2) n++; }
  k += Math.min(1, n/A.crowd) * A.crowdK;                                                                     // a crowd closing in
  for(const f of FORTS){ if(f.captured) continue; const d=Math.hypot(f.x-px, f.z-pz); if(d < f.R+A.fortPad){ k += A.fortK; break; } }   // a fortress ahead / inside one
  { const F=VISLOOK.frame; for(const B of FBOSS.list){ const e=B.e; if(e && B.st!=='dead' && Math.hypot(e.pos.x-px, e.pos.z-pz)<F.bossR){ k += F.bossPull; break; } } }   // VIS 1 a fort boss close by: the lens draws back to hold all of him
  return Math.min(A.max, k); }
// Z239 SMOOTH CAMERA — every moving part of the view is a critically-damped spring (SmoothDamp): the tank is followed tightly, the
//   aim/motion look-ahead glides (a flick of the mouse never yanks the frame), zoom eases in log space (equal feel near and far), the
//   view turns along the shortest arc so the camera ORBITS the tank instead of cutting a chord through it, and after any cinematic
//   (intro, death cam) the view glides back over CAM_FEEL.resume s instead of snapping. S.zoomT / S.camYawT are what the player asked
//   for; S.zoom / S.camYaw are what is on screen (driving stays relative to what you see).
const CAM={ lift:0, liftV:0, on:false, t:-1, lx:0,lxV:0, lz:0,lzV:0, fx:0,fxV:0, fz:0,fzV:0, ya:0,yaV:0, zl:0,zlV:0, dash:0,dashV:0, kick:0, blend:0, bf:58,
  bp:new THREE.Vector3(), bq:new THREE.Quaternion() };
const _q0=new THREE.Quaternion();
function sd(o, k, target, st, dt){ const kv=k+'V', om=2/st, x=om*dt, e=1/(1+x+0.48*x*x+0.235*x*x*x), ch=o[k]-target, tmp=(o[kv]+om*ch)*dt;
  o[kv]=(o[kv]-om*tmp)*e; o[k]=target+(ch+tmp)*e; }
export const smoother = u => u<=0 ? 0 : u>=1 ? 1 : u*u*u*(u*(u*6-15)+10);   // smootherstep: zero velocity AND acceleration at both ends
export function camShakeGain(){ let k; try{ k=PROFILE.shake; }catch(e){} const L=SHAKE.levels; return L[k]!=null ? L[k] : L[SHAKE.def]; }
const tiltPull=()=>Math.min(1, Math.max(0, (S.camTilt||0)/CAM_FEEL.tilt.max));   // CAM 1 how far the player has tilted the lens up (0…1)
function camOffset(zoom, yaw, zk, out){ const k=Math.max(0.26, zoom + S.camZ*zk)*((S.player&&S.player.camK)||1);   // Z245 cavalry: a man needs a closer lens
  out.set(camOff.x*k, camOff.y*k*(k<1 ? 0.78+0.22*k : 1)*(k<0.55 ? 0.8+0.2*k/0.55 : 1), camOff.z*k);   // player zoom + the auto camera's pull-back · Z165 close-ups sit a little lower
  { const t=S.camTilt||0; if(t){ const r=Math.hypot(out.y, out.z), T=CAM_FEEL.tilt, a0=Math.atan2(out.y, out.z), a=t>0 ? Math.max(a0, Math.min(T.top, a0+t)) : Math.min(a0, Math.max(T.low, a0+t)); out.y=r*Math.sin(a); out.z=r*Math.cos(a); } }   // CAM 1 the player's tilt: the same distance, higher or lower
  if(yaw) out.applyAxisAngle(_camUP, yaw); return out; }
// the settled pose the follow camera is heading for (no shake, no kick) — the intro lands on it exactly, so play starts without a jolt
// Z241 the lowest extra height (CAM_FEEL.lift) from which the lens at `pos` sees the tank's hull over every wall in the way
function liftOk(pos, p, hy, L, all, inFort){ const y=pos.y+L; return (inFort || !fortBeamBlocked(pos.x, y, pos.z, p.pos.x, hy, p.pos.z)) && !coreBeamBlocked(pos.x, y, pos.z, p.pos.x, hy, p.pos.z) && sightToGround(p.pos.x, hy, p.pos.z, pos.x, y, pos.z) >= 1
  && (!all || sightToBuildings(p.pos.x, hy, p.pos.z, pos.x, y, pos.z) >= 1 && sightToRocks(p.pos.x, hy, p.pos.z, pos.x, y, pos.z) >= 1); }   // (Z337 a city building too · NO-TANKS 10 a hill's crest, a big rock)
export function camLift(pos, p, inFort){ const F=CAM_FEEL, hy=heightAt(p.pos.x, p.pos.z)+(p.lift||0)+(p.cav ? 1.6 : 3.2), LO=CAM_ROOM.occ.liftObj; let L0=F.lift[F.lift.length-1];
  for(const L of F.lift) if(liftOk(pos, p, hy, L, false, inFort)){ L0=L; break; }   // a fort's wall, our wall, a hill's crest: the whole ladder (CAM 3 inside a fort its own walls are cut, not climbed)
  if(L0<=LO) for(const L of F.lift){ if(L<L0) continue; if(L>LO) break; if(liftOk(pos, p, hy, L, true, inFort)) return L; }   // CAM 4 a building / rock: only a small lift (liftObj m) — past that it is cut away (render/see-through.js), never climbed
  return L0; }
// CAM 3 how far inside a fort's walls he stands (0 outside … 1 within CAM_ROOM.fort.inR of its inner wall) — the lens climbs over him there
export function camFortIn(p){ const C=CAM_ROOM.fort; let k=0; for(const f of FORTS){ if(!f.g) continue; const d=Math.hypot(f.x-p.pos.x, f.z-p.pos.z), a=(f.Rin||f.R)-C.inR, b=f.R+C.outR; if(d>=b) continue; k=Math.max(k, d<=a ? 1 : 1-(d-a)/(b-a)); } return k; }
// CAM 3 the offset (lens from the look point) tipped up to CAM_ROOM.fort.pitch and scaled by its distK, by share k
const _DEG=Math.PI/180;
export function camFortPose(o, k){ const C=CAM_ROOM.fort, h=Math.hypot(o.x, o.z), r=Math.hypot(h, o.y), a0=Math.atan2(o.y, h), a=a0+Math.max(0, C.pitch*_DEG-a0)*k, r2=r*(1+(C.distK-1)*k), nh=r2*Math.cos(a);
  if(h>1e-4){ o.x*=nh/h; o.z*=nh/h; } o.y=r2*Math.sin(a); return o; }
// NO-TANKS 10 the ground under the follow camera: the soldier's own ground, as the lens follows it (none in the base under the field: its floor is the world's)
export const camGround = p => underActive(p.pos.x) ? 0 : heightAt(p.pos.x, p.pos.z);
// NO-TANKS 10 a tree right before the lens: up on the hills the lens rides among their trees, and a trunk a metre from it filled half the screen (one
//   by the soldier is a sliver) — so only the near end of the sight line counts (from 60 % of the way out), up to the tree's own top; share 0…1, or 1
const _tM = new THREE.Matrix4(), _tP = new THREE.Vector3(), _tQ = new THREE.Quaternion(), _tS = new THREE.Vector3();
function treeTop(c){ const g=c.im && c.im.geometry; if(!g) return heightAt(c.x, c.z)+8; if(c._ttG===g) return c._tt; if(!g.boundingBox) g.computeBoundingBox();
  c.im.getMatrixAt(c.k, _tM); _tM.decompose(_tP, _tQ, _tS); c._ttG=g; return (c._tt = _tP.y+g.boundingBox.max.y*_tS.y); }
export function sightToTrunks(ax, ay, az, bx, by, bz){ const dx=bx-ax, dz=bz-az, L2=dx*dx+dz*dz; if(L2<4) return 1; let t0=1;
  const x0=Math.min(ax, bx)-3, x1=Math.max(ax, bx)+3, z0=Math.min(az, bz)-3, z1=Math.max(az, bz)+3;
  for(const c of crushables){ if(c.kind!=='tree' || !c.alive || c.x<x0 || c.x>x1 || c.z<z0 || c.z>z1) continue; const u=((c.x-ax)*dx+(c.z-az)*dz)/L2; if(u<0.6 || u>1.02) continue;
    const ex=ax+dx*u-c.x, ez=az+dz*u-c.z, r=trunkR(c)+0.35, e2=ex*ex+ez*ez; if(e2>=r*r || ay+(by-ay)*u>treeTop(c)) continue; t0=Math.min(t0, Math.max(0, u-Math.sqrt(r*r-e2)/Math.sqrt(L2))); }
  return t0; }
// where the sight line a → b first dips under the ground (share 0…1 of the way), or 1 if it stays over it: a hill's crest between the lens and him
export function sightToGround(ax, ay, az, bx, by, bz){ if(underActive(ax)) return 1; const n=Math.min(28, Math.max(4, Math.ceil(Math.hypot(bx-ax, bz-az)/1.1)));
  for(let i=1; i<=n; i++){ const u=i/n; if(ay+(by-ay)*u < heightAt(ax+(bx-ax)*u, az+(bz-az)*u)+0.3) return (i-1)/n; }
  return 1; }
// VIS 1 FRAMING: the lens's look height solved so his chest stands at VISLOOK.frame.y of the screen's height (in the vertical plane of the view): from
//   the lens at c looking toward (tx, tz) on the ground plan, the pitch that puts him there; a fort boss within bossR m keeps his top under topK of
//   the upper half (the view tips up) while the soldier's chest stays above footK of the lower half; null when the look point is under the lens
const _DEGR=Math.PI/180;
export const frameChest = p => p.cav ? (p.bike ? 1.5 : 1.9) : CV.stance==='prone' ? 0.45 : CV.stance==='crouch' ? 0.85 : 1.2;
export function frameLookY(c, tx, tz, p, fov){ const F=VISLOOK.frame, hx=tx-c.x, hz=tz-c.z, dT=Math.hypot(hx, hz); if(!F.on || dT<0.5) return null;
  const fx=hx/dT, fz=hz/dT, py=heightAt(p.pos.x, p.pos.z)+(p.lift||0)+frameChest(p), dP=Math.max(0.8, (p.pos.x-c.x)*fx+(p.pos.z-c.z)*fz), th=Math.tan(fov*_DEGR/2);
  const aP=Math.atan2(py-c.y, dP); let aF=aP-Math.atan((1-2*(MOBILE ? F.yM : F.y))*th);
  for(const B of FBOSS.list){ const e=B.e; if(!e || B.st==='dead') continue; const bx=e.pos.x-c.x, bz=e.pos.z-c.z; if(bx*bx+bz*bz>F.bossR*F.bossR) continue;
    const bd=bx*fx+bz*fz; if(bd<1) continue; const aT=Math.atan2(heightAt(e.pos.x, e.pos.z)+(e.bossH||3.4)-c.y, bd); aF=Math.min(Math.max(aF, aT-Math.atan(F.topK*th)), aP+Math.atan(F.footK*th)); }
  return c.y+Math.tan(aF)*dT; }
// VIS 1 the lens may look down on him at most maxEl°: past that it comes down (and out to 2.5 m) — what stands between is faded, not climbed over
function frameMaxEl(c, p){ const F=VISLOOK.frame; if(!F.on) return; const py=heightAt(p.pos.x, p.pos.z)+(p.lift||0)+frameChest(p), dx=c.x-p.pos.x, dz=c.z-p.pos.z, hd=Math.hypot(dx, dz), t=Math.tan(F.maxEl*_DEGR);
  if(c.y-py <= t*Math.max(hd, 0.01)) return; const h2=Math.max(hd, 2.5); if(hd>0.01 && h2>hd){ c.x=p.pos.x+dx/hd*h2; c.z=p.pos.z+dz/hd*h2; } c.y=py+t*h2; }
// VIS 10–11 our HQ's shield dome is a lattice of hexes drawn additively: from inside, and from close outside, it lay across the view as blue lines —
//   so it is drawn only while the emergency shield is up
function domeFade(){ const d=core && core.dome; if(!d) return;
  const inside=(core.shieldUntil||0)<=performance.now()/1000;   // VIS 11 at rest not drawn at all (from close outside too its lattice lay across the view): only the emergency shield shows it
  if(d.visible===inside) d.visible=!inside; }
// VIS 4 THE MENU'S BACKDROP: behind the home screen and its overlays the scene is no longer a top view of the Core (it read as a tank, and the
//   game has none) — a slow, low orbit across the field toward its far side and the horizon; the Core waits out of sight until a battle
const MC={ on:false, a:0 };
export function menuCam(dt){ const M=VISLOOK.menu, cm=core && core.mesh; if(!M.on || S.mode!=='start'){ if(MC.on){ MC.on=false; if(cm) cm.visible=true; } return; }
  if(!MC.on){ MC.on=true; MC.a=Math.random()*6.283; } if(cm && cm.visible) cm.visible=false; MC.a+=dt*M.spin;
  const x=Math.sin(MC.a)*M.r, z=Math.cos(MC.a)*M.r, lx=-Math.sin(MC.a)*M.look, lz=-Math.cos(MC.a)*M.look;
  camera.position.set(x, heightAt(x, z)+M.h, z); camera.lookAt(lx, heightAt(lx, lz)+M.lookY, lz); }
export function camRestPose(pos, look){ const p=S.player; if(!p) return false; const fk=camFortIn(p), CS=applyCamStyle(), ck=p.camK||1, z=S.zoomT??S.zoom??1, zk=Math.min(1,z), y=S.camYawT??S.camYaw??0, ah=CS.ahead*Math.max(0.4,zk)*ck*ck;
  const lx=(Math.sin(p.aim||0)*6+p.vel.x*0.18)*0.45*zk, lz=(Math.cos(p.aim||0)*6+p.vel.z*0.18)*0.45*zk;
  { const tu=tiltPull(), fl=1-CAM_ROOM.fort.lead*smoother(fk), k=(1-CAM_FEEL.tilt.ahead*tu)*fl, kl=(1-CAM_FEEL.tilt.lead*tu)*fl; look.set(p.pos.x+lx*kl-Math.sin(y)*ah*k, (CS.lookY+Math.max(0,0.6-z)*2.2)*ck, p.pos.z+lz*kl-Math.cos(y)*ah*k); }
  camOffset(z, y, zk, pos); if(fk>0.001) camFortPose(pos, smoother(fk)); { const an=VISLOOK.frame.on ? VISLOOK.frame.anchor : 1; pos.x+=p.pos.x+(look.x-p.pos.x)*an; pos.z+=p.pos.z+(look.z-p.pos.z)*an; } { const g=camGround(p); pos.y+=g; look.y+=g; } pos.y+=camLift(pos, p, fk>0.5);   // (VIS 1 the lens rides on him: anchor × the look-ahead)
  frameMaxEl(pos, p); { const fy=frameLookY(pos, look.x, look.z, p, CS.fov); if(fy!=null) look.y=fy; } return CS.fov; }   // (VIS 1 framed as play will be)   // (CAM 3 inside a fort: over him)   // (NO-TANKS 10 from his own ground)   // (lifted over a wall in the way, as play will be)
// Z301 RIDING CAMERA: a chase camera that rides with the machine — it rises and settles with the suspension's heave, buzzes with the road at speed,
//   banks a little with the bike into a bend, dips its nose under the brakes and lifts under the throttle, and the lens widens as the throttle opens;
//   all scaled by the player's own shake setting (CÀI ĐẶT → RUNG MÀN HÌNH: off is off)
const RC = { roll:0, pitch:0, fov:0 };
function rideCam(p, dt, now, g){ const H = p.cav && p.cav.H, I = H && H.inert, U = CAM_FEEL.ride; if(!I || !U) return; const k = Math.min(1.4, g / SHAKE.levels.mid), sp = Math.min(1, Math.hypot(p.vel.x, p.vel.z) / 8);
  if(k <= 0) return; const e = 1 - Math.exp(-dt * U.ease);
  camera.position.y += ((H.sus ? H.sus.y : 0) * U.heave + (Math.sin(now * 29.3) * 0.6 + Math.sin(now * 47.1 + 1.3) * 0.4) * U.buzz * sp) * k;
  RC.roll += ((H.two === false ? 0 : (H.lean || 0)) * U.bank - RC.roll) * e; RC.pitch += ((I.p || 0) * U.pitch - RC.pitch) * e; RC.fov += (Math.max(0, Math.min(8, I.acc)) * U.fovAcc - RC.fov) * e;
  camera.rotateX(RC.pitch * k); camera.rotateZ(RC.roll * k);
  if(RC.fov > 0.02){ camera.fov += RC.fov * k; camera.updateProjectionMatrix(); camera.fov -= RC.fov * k; } }
// CAM 3 the cut-away's place this frame (render/see-through.js): him and the ground he aims at (CAM_ROOM.see.ahead m out), where they are on screen
//   and how deep in the view he stands; new solids let in every sweep s (his own kit never)
const _sv=new THREE.Vector3(), _seeSkip=[null, null, null];
function seeCam(p){ const C=CAM_ROOM.see, u=SEE.u; SEE.at=performance.now()/1000; if(!C.on){ u.uSeeB.value.w=0; return; }
  _seeSkip[0]=p.mesh||null; _seeSkip[1]=CV.G||null; _seeSkip[2]=(CV.H && CV.H.root)||null; seeSweep(SEE.at, _seeSkip);
  camera.updateMatrixWorld(); const asp=camera.aspect, gH=heightAt(p.pos.x, p.pos.z)+(p.lift||0);
  _sv.set(p.pos.x, gH+1.2, p.pos.z).applyMatrix4(camera.matrixWorldInverse); const dz=-_sv.z; _sv.applyMatrix4(camera.projectionMatrix); const hx=_sv.x*asp, hy=_sv.y;
  const a=camAimA(p), ax=p.pos.x+Math.sin(a)*C.ahead, az=p.pos.z+Math.cos(a)*C.ahead; let tx=hx, ty=hy;
  _sv.set(ax, heightAt(ax, az)+1.0, az).applyMatrix4(camera.matrixWorldInverse); if(-_sv.z>0.5){ _sv.applyMatrix4(camera.projectionMatrix); tx=_sv.x*asp; ty=_sv.y; }
  u.uSeeA.value.set(hx, hy, tx, ty); u.uSeeB.value.set(dz, MOBILE ? C.rM : C.r, C.near, dz>0.5 ? C.k : 0); u.uSeeB.value.z=Math.max(C.near, VISLOOK.see.near); u.uSeeC.value.set(asp, C.soft, C.far, C.ramp); }
// (VIS 11 the near cut reaches VISLOOK.see.near m: a wall's corner 3 m from the lens filled half the screen)
export function updateCamera(dt, now){
  const p=S.player; if(!p) return;
  const F=CAM_FEEL, CS=applyCamStyle(), st=Math.min(dt, 1/20);
  if(now-CAM.t > 0.15 || !CAM.on){   // first frame, or back from a cinematic / the death cam / a pause → springs settle on the goal, the view glides over
    CAM.blend = CAM.on ? F.resume : 0; CAM.on=true;
    S.zoom=S.zoomT??S.zoom; S.camYaw=S.camYawT??S.camYaw; CAM.zl=Math.log(Math.max(0.05,S.zoom)); CAM.ya=S.camYaw; CAM.ti=S.camTilt=S.camTiltT||0; CAM.tiV=0;
    const zk=Math.min(1,S.zoom); CAM.lx=(Math.sin(p.aim||0)*6+p.vel.x*0.18)*0.45*zk; CAM.lz=(Math.cos(p.aim||0)*6+p.vel.z*0.18)*0.45*zk; CAM.fx=p.pos.x; CAM.fz=p.pos.z;
    CAM.lxV=CAM.lzV=CAM.fxV=CAM.fzV=CAM.yaV=CAM.zlV=CAM.dashV=0; CAM.fy=null; CAM.fyV=0; armReset(); CAM.dash=0; CAM.kick=0; CAM.liftSnap=true; CAM.fk=camFortIn(p); CAM.gy=camGround(p); CAM.gyV=0; camRocksStale();   // (NO-TANKS 10 a new field: its rocks)
    CAM.bp.copy(camera.position); CAM.bq.copy(camera.quaternion); CAM.bf=camera.fov; }
  CAM.t=now;
  sd(CAM, 'zl', Math.log(Math.max(0.05, S.zoomT??S.zoom)), F.zoom, st); S.zoom=Math.exp(CAM.zl);                    // zoom glides
  { const yt=S.camYawT??S.camYaw, d=wrapAngle(yt-CAM.ya); sd(CAM, 'ya', CAM.ya+d, F.yaw, st);                       // the view turns along the shortest arc
    if(Math.abs(d)<2e-4 && Math.abs(CAM.yaV)<2e-3){ CAM.ya=yt; CAM.yaV=0; } S.camYaw=CAM.ya; }
  sd(CAM, 'ti', S.camTiltT||0, F.yaw, st); S.camTilt=CAM.ti;                                                       // CAM 1 the tilt glides the same way
  const ck=(p.camK||1), z=S.zoom, zk=Math.min(1, z), cy=S.camYaw, ah=CS.ahead*Math.max(0.4, zk)*ck*ck;   // Z245 a man / horseman: look-ahead shrinks (×camK²) so he stays in frame   // Z171 close-ups keep the tank centred · Z184 the cine style looks well ahead
  const la=camAimA(p); sd(CAM, 'lx', (Math.sin(la)*6 + p.vel.x*0.18)*0.45*zk, F.lead, st); sd(CAM, 'lz', (Math.cos(la)*6 + p.vel.z*0.18)*0.45*zk, F.lead, st);   // look-ahead (aim + motion) glides (Z376 the aim as the mouse last laid it: combat/crosshair.js)
  sd(CAM, 'fx', p.pos.x, F.follow, st); sd(CAM, 'fz', p.pos.z, F.follow, st);                                       // the tank itself is held tight
  camLook.set(CAM.lx, 0, CAM.lz);
  { const tu=tiltPull(), fl=1-CAM_ROOM.fort.lead*smoother(CAM.fk||0), k=(1-CAM_FEEL.tilt.ahead*tu)*fl, kl=(1-CAM_FEEL.tilt.lead*tu)*fl; camTarget.set(CAM.fx + CAM.lx*kl - Math.sin(cy)*ah*k, 0, CAM.fz + CAM.lz*kl - Math.cos(cy)*ah*k); }   // CAM 1 tilted up: the lens looks back toward him (he stays in frame)
  if(now>=_camAutoAt){ _camAutoAt=now+CAM_AUTO.every; _camAutoWant=S.camAuto ? camAutoPull(p) : 0; }   // Z110 auto camera (sampled 4×/s, eased every frame)
  S.camZ += (_camAutoWant - S.camZ) * (1-Math.exp(-dt*CAM_AUTO.ease));
  camOffset(z, cy, zk, _camOff);
  { const k=Math.min(1, dt*CLIMB.cam.rate); CAM.cp=(CAM.cp??1)+(((p.cav && climbing()) ? CLIMB.cam.pull : 1)-(CAM.cp??1))*k; CAM.ly=(CAM.ly??0)+((p.lift||0)-(CAM.ly??0))*Math.min(1, dt*6); if(CAM.cp>1.001) _camOff.multiplyScalar(CAM.cp); }   // Z451 on a wall's face the lens draws back; up on top it rides up with him
  { const fk=camFortIn(p); CAM.fk=(CAM.fk??fk)+(fk-(CAM.fk??fk))*(1-Math.exp(-dt*CAM_ROOM.fort.ease)); if(CAM.fk>0.001) camFortPose(_camOff, smoother(CAM.fk)); }   // CAM 3 inside a fort the lens climbs over him (its walls, towers and keep are cut away, not climbed)
  sd(CAM, 'dash', (now && now < p.dashUntil) ? F.dashPull : 0, F.dash, st);   // eases back during a dash
  sd(CAM, 'gy', camGround(p), F.ground, st);   // NO-TANKS 10 the lens rides up a hill with him and down again (it held one height: on a 12–17 m crag it sat inside the hill)
  { const an=VISLOOK.frame.on ? VISLOOK.frame.anchor : 1; camBase.set(CAM.fx+(camTarget.x-CAM.fx)*an+_camOff.x, _camOff.y+CAM.dash+CAM.ly+CAM.gy, CAM.fz+(camTarget.z-CAM.fz)*an+_camOff.z); }   // VIS 1 the lens rides on him; only anchor × the look-ahead carries it forward
  const inF=CAM.fk>0.5; if(CAM.liftSnap){ CAM.liftSnap=false; CAM.lift=camLift(camBase, p, inF); CAM.liftV=0; }
  CAM.lt=camLift(camBase, p, inF); sd(CAM, 'lift', CAM.lt, CAM_FEEL.liftT, st); camBase.y+=CAM.lift;   // Z241 a great wall between the lens and the tank → rise over it, settle back when clear
  { const hy=heightAt(p.pos.x, p.pos.z)+(p.cav ? 1.6 : 3.2), yt=Math.max(camBase.y, camBase.y-CAM.lift+CAM.lt), hd=Math.hypot(camBase.x-p.pos.x, camBase.z-p.pos.z), o=CAM.occ ?? 1;   // Z337 a building between the lens and you (or the lens
    const t=Math.min(sightToBuildings(p.pos.x, hy, p.pos.z, camBase.x, yt, camBase.z), sightToRocks(p.pos.x, hy, p.pos.z, camBase.x, yt, camBase.z), sightToGround(p.pos.x, hy, p.pos.z, camBase.x, yt, camBase.z));   // (NO-TANKS 10 a hill, a rock too — and judged from the height the lens is rising to: what the rise will clear, it does not also dive in for · CAM 4 a tree, its branches and trunk never move it: they are cut away, render/see-through.js)
    let want=1, top=0; if(t<1){ const u=t-0.05; if(u*hd>=1.6) want=u; else top=1; }   //   inside one): it comes in on its sight line to this side of the wall; with no room for it there (his back to it) it rises a little
    const O=CAM_ROOM.occ; CAM.blkT=(want<1 || top) ? (CAM.blkT||0)+dt : 0; if(CAM.blkT<O.delay){ want=1; top=0; }   // CAM 4 a corner glimpsed for a moment moves nothing (the cut shows him)
    if(want<1){ CAM.ow=want; CAM.owT=now+O.hold; } else if(now<(CAM.owT||0)) want=CAM.ow;   // CAM 4 and once in, it holds a moment after the line clears (no in-out-in along a row of posts)
    if(top) CAM.topT=now+CAM_FEEL.topHold; else if(now<(CAM.topT||0)) top=1;   // (NO-TANKS 10 held a moment: along a rock face it flicked up and down)
    CAM.occ = o+(want-o)*Math.min(1, dt*(want<o ? O.inK : 2.5)); CAM.top = (CAM.top||0)+(top-(CAM.top||0))*Math.min(1, dt*(top>(CAM.top||0) ? CAM_FEEL.topIn : 2));   // (NO-TANKS 10 in gliding — it cut in a frame — and back out slowly)
    if(CAM.occ<0.999) camBase.set(p.pos.x+(camBase.x-p.pos.x)*CAM.occ, hy+(camBase.y-hy)*CAM.occ, p.pos.z+(camBase.z-p.pos.z)*CAM.occ);
    if(CAM.top>0.001) camBase.y+=O.rise*CAM.top; }   // CAM 4 his back to it: the lens stays where it is and rises rise m at most — the wall between is cut away (it used to leap to a top view 9 m over him)
  frameMaxEl(camBase, p);   // VIS 1 never a top view in a tight yard
  { const A=VISLOOK.arm, hk=p.cav ? A.head[1] : CV.stance==='prone' ? A.head[2] : A.head[0]; _seeSkip[0]=p.mesh||null; _seeSkip[1]=CV.G||null; _seeSkip[2]=(CV.H && CV.H.root)||null;
    armPull(camBase, p.pos.x, heightAt(p.pos.x, p.pos.z)+(p.lift||0)+hk, p.pos.z, dt, now, _seeSkip); }   // VIS 2 the spring arm: never inside a solid, never pressed to one (render/cam-arm.js)
  if(!underActive(p.pos.x)){ const g=heightAt(camBase.x, camBase.z)+0.9; if(camBase.y<g) camBase.y=g; }   // NO-TANKS 10 and never under the ground it is over
  { const ly0=(CS.lookY+Math.max(0, 0.6-z)*2.2)*ck+CAM.ly+CAM.gy, fy=frameLookY(camBase, camTarget.x, camTarget.z, p, camera.fov), w=fy==null ? ly0 : fy;   // VIS 1 the pitch that frames him
    if(CAM.fy==null){ CAM.fy=w; CAM.fyV=0; } else sd(CAM, 'fy', w, VISLOOK.frame.ease, st); }
  camera.position.copy(camBase);
  steadyCam(camBase, camTarget.x, CAM.fy, camTarget.z, Math.max(10, camera.fov-Math.min(2, CAM.kick*1.4)*F.kick), camera.aspect, !(CAM.blend>0));   // Z382 the pose before the kick and the shake: the crosshair looks through it (combat/crosshair.js)
  const g=camShakeGain(), tr=Math.min(1, S.shake/3.2), t2=tr*tr*g;   // TRAUMA model: shake ∝ trauma² × the player's level (CÀI ĐẶT → RUNG MÀN HÌNH), a slow rumble, not a buzz
  if(t2>0.0004){ const q=now, A=SHAKE.pos*t2; camera.position.x += (Math.sin(q*31.1)+Math.sin(q*52.7+1.7)*0.45)*A; camera.position.y += (Math.sin(q*27.3+0.4)+Math.sin(q*47.9)*0.4)*A*0.55; camera.position.z += (Math.sin(q*35.9+2.1)+Math.sin(q*44.3)*0.45)*A; }
  CAM.kick += ((S.camKick||0) - CAM.kick)*(1-Math.exp(-dt*28));   // Z168 the shot shoves the camera back along the barrel (now eased in over a couple of frames, not a one-frame jump)
  { const k=CAM.kick*F.kick*(0.4+0.6*Math.min(1, g/SHAKE.levels.mid)); if(k>0.004){ const a=S.kickAng||0; camera.position.x -= Math.sin(a)*k*0.75; camera.position.z -= Math.cos(a)*k*0.75; camera.position.y += k*0.32; } }
  S.camKick=(S.camKick||0)*Math.exp(-dt*10);
  camera.lookAt(camTarget.x, CAM.fy ?? (CS.lookY+Math.max(0, 0.6-z)*2.2)*ck+CAM.ly+CAM.gy, camTarget.z);   // (VIS 1 framed) Z171 the closest views aim at the hull, not its tracks
  { const want=CS.fov + CS.speedFov*Math.min(1, Math.hypot(p.vel.x, p.vel.z)/PLAYER.maxSpeed) + Math.min(2, CAM.kick*1.4)*F.kick, f=camera.fov+(want-camera.fov)*(1-Math.exp(-dt*F.fovEase));   // the lens breathes with speed, never steps
    if(CAM.blend>0){ CAM.blend=Math.max(0, CAM.blend-dt); const b=smoother(1-CAM.blend/F.resume);   // gliding home from a cinematic
      camera.position.lerpVectors(CAM.bp, camera.position, b); _q0.copy(camera.quaternion); camera.quaternion.slerpQuaternions(CAM.bq, _q0, b); camera.fov=CAM.bf+(f-CAM.bf)*b; camera.updateProjectionMatrix(); }
    else if(Math.abs(camera.fov-f)>0.005){ camera.fov=f; camera.updateProjectionMatrix(); } }
  if(t2>0.0004) camera.rotateZ((Math.sin(now*23.7)+Math.sin(now*41.3+0.9)*0.45)*t2*SHAKE.roll);   // roll
  if(p.cav && p.bike) rideCam(p, dt, now, g);   // Z301 on the ride: the camera feels the road
  gradePass.uniforms.aberr.value = t2*SHAKE.aberr;
  seeCam(p);   // CAM 3 where the cut-away goes this frame
  domeFade();   // VIS 10 the lens inside our HQ's shield dome: the dome is not drawn
  S.shake = Math.max(0, S.shake - dt*(S.shake*2.6 + 1.2));
}
