// game/update.js — the camera that follows the soldier, the enemy vehicles' rigs, Vietnamese label helpers (no-tanks: the tank's drive / aim / fire is gone)
import * as THREE from 'three';
import { CAM_AUTO, CAM_STYLE, CAM_FEEL, SHAKE, CLIMB } from '../../config.js';
import { BIOME_VI, FORTS, MOBILE, PLAYER, PROFILE, S, camera, coreBeamBlocked, enemies, fortBeamBlocked, gradePass, heightAt, sightToBuildings, sightToRocks, camRocksStale, underActive, crushables, trunkR, camAimA, steadyCam, climbing } from '../hub.js';

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
function camOffset(zoom, yaw, zk, out){ const k=Math.max(0.26, zoom + S.camZ*zk)*((S.player&&S.player.camK)||1);   // Z245 cavalry: a man needs a closer lens
  out.set(camOff.x*k, camOff.y*k*(k<1 ? 0.78+0.22*k : 1)*(k<0.55 ? 0.8+0.2*k/0.55 : 1), camOff.z*k);   // player zoom + the auto camera's pull-back · Z165 close-ups sit a little lower
  if(yaw) out.applyAxisAngle(_camUP, yaw); return out; }
// the settled pose the follow camera is heading for (no shake, no kick) — the intro lands on it exactly, so play starts without a jolt
// Z241 the lowest extra height (CAM_FEEL.lift) from which the lens at `pos` sees the tank's hull over every wall in the way
export function camLift(pos, p){ const F=CAM_FEEL, hy=heightAt(p.pos.x, p.pos.z)+(p.lift||0)+(p.cav ? 1.6 : 3.2);
  for(const L of F.lift){ const y=pos.y+L; if(!fortBeamBlocked(pos.x, y, pos.z, p.pos.x, hy, p.pos.z) && !coreBeamBlocked(pos.x, y, pos.z, p.pos.x, hy, p.pos.z) && sightToBuildings(p.pos.x, hy, p.pos.z, pos.x, y, pos.z) >= 1
    && sightToGround(p.pos.x, hy, p.pos.z, pos.x, y, pos.z) >= 1 && sightToRocks(p.pos.x, hy, p.pos.z, pos.x, y, pos.z) >= 1) return L; }   // (Z337 a city building too · NO-TANKS 10 a hill's crest, a big rock)
  return F.lift[F.lift.length-1]; }
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
export function camRestPose(pos, look){ const p=S.player; if(!p) return false; const CS=applyCamStyle(), ck=p.camK||1, z=S.zoomT??S.zoom??1, zk=Math.min(1,z), y=S.camYawT??S.camYaw??0, ah=CS.ahead*Math.max(0.4,zk)*ck*ck;
  const lx=(Math.sin(p.aim||0)*6+p.vel.x*0.18)*0.45*zk, lz=(Math.cos(p.aim||0)*6+p.vel.z*0.18)*0.45*zk;
  look.set(p.pos.x+lx-Math.sin(y)*ah, (CS.lookY+Math.max(0,0.6-z)*2.2)*ck, p.pos.z+lz-Math.cos(y)*ah);
  camOffset(z, y, zk, pos); pos.x+=look.x; pos.z+=look.z; { const g=camGround(p); pos.y+=g; look.y+=g; } pos.y+=camLift(pos, p); return CS.fov; }   // (NO-TANKS 10 from his own ground)   // (lifted over a wall in the way, as play will be)
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
export function updateCamera(dt, now){
  const p=S.player; if(!p) return;
  const F=CAM_FEEL, CS=applyCamStyle(), st=Math.min(dt, 1/20);
  if(now-CAM.t > 0.15 || !CAM.on){   // first frame, or back from a cinematic / the death cam / a pause → springs settle on the goal, the view glides over
    CAM.blend = CAM.on ? F.resume : 0; CAM.on=true;
    S.zoom=S.zoomT??S.zoom; S.camYaw=S.camYawT??S.camYaw; CAM.zl=Math.log(Math.max(0.05,S.zoom)); CAM.ya=S.camYaw;
    const zk=Math.min(1,S.zoom); CAM.lx=(Math.sin(p.aim||0)*6+p.vel.x*0.18)*0.45*zk; CAM.lz=(Math.cos(p.aim||0)*6+p.vel.z*0.18)*0.45*zk; CAM.fx=p.pos.x; CAM.fz=p.pos.z;
    CAM.lxV=CAM.lzV=CAM.fxV=CAM.fzV=CAM.yaV=CAM.zlV=CAM.dashV=0; CAM.dash=0; CAM.kick=0; CAM.liftSnap=true; CAM.gy=camGround(p); CAM.gyV=0; camRocksStale();   // (NO-TANKS 10 a new field: its rocks)
    CAM.bp.copy(camera.position); CAM.bq.copy(camera.quaternion); CAM.bf=camera.fov; }
  CAM.t=now;
  sd(CAM, 'zl', Math.log(Math.max(0.05, S.zoomT??S.zoom)), F.zoom, st); S.zoom=Math.exp(CAM.zl);                    // zoom glides
  { const yt=S.camYawT??S.camYaw, d=wrapAngle(yt-CAM.ya); sd(CAM, 'ya', CAM.ya+d, F.yaw, st);                       // the view turns along the shortest arc
    if(Math.abs(d)<2e-4 && Math.abs(CAM.yaV)<2e-3){ CAM.ya=yt; CAM.yaV=0; } S.camYaw=CAM.ya; }
  const ck=(p.camK||1), z=S.zoom, zk=Math.min(1, z), cy=S.camYaw, ah=CS.ahead*Math.max(0.4, zk)*ck*ck;   // Z245 a man / horseman: look-ahead shrinks (×camK²) so he stays in frame   // Z171 close-ups keep the tank centred · Z184 the cine style looks well ahead
  const la=camAimA(p); sd(CAM, 'lx', (Math.sin(la)*6 + p.vel.x*0.18)*0.45*zk, F.lead, st); sd(CAM, 'lz', (Math.cos(la)*6 + p.vel.z*0.18)*0.45*zk, F.lead, st);   // look-ahead (aim + motion) glides (Z376 the aim as the mouse last laid it: combat/crosshair.js)
  sd(CAM, 'fx', p.pos.x, F.follow, st); sd(CAM, 'fz', p.pos.z, F.follow, st);                                       // the tank itself is held tight
  camLook.set(CAM.lx, 0, CAM.lz);
  camTarget.set(CAM.fx + CAM.lx - Math.sin(cy)*ah, 0, CAM.fz + CAM.lz - Math.cos(cy)*ah);
  if(now>=_camAutoAt){ _camAutoAt=now+CAM_AUTO.every; _camAutoWant=S.camAuto ? camAutoPull(p) : 0; }   // Z110 auto camera (sampled 4×/s, eased every frame)
  S.camZ += (_camAutoWant - S.camZ) * (1-Math.exp(-dt*CAM_AUTO.ease));
  camOffset(z, cy, zk, _camOff);
  { const k=Math.min(1, dt*CLIMB.cam.rate); CAM.cp=(CAM.cp??1)+(((p.cav && climbing()) ? CLIMB.cam.pull : 1)-(CAM.cp??1))*k; CAM.ly=(CAM.ly??0)+((p.lift||0)-(CAM.ly??0))*Math.min(1, dt*6); if(CAM.cp>1.001) _camOff.multiplyScalar(CAM.cp); }   // Z451 on a wall's face the lens draws back; up on top it rides up with him
  sd(CAM, 'dash', (now && now < p.dashUntil) ? F.dashPull : 0, F.dash, st);   // eases back during a dash
  sd(CAM, 'gy', camGround(p), F.ground, st);   // NO-TANKS 10 the lens rides up a hill with him and down again (it held one height: on a 12–17 m crag it sat inside the hill)
  camBase.set(camTarget.x+_camOff.x, _camOff.y+CAM.dash+CAM.ly+CAM.gy, camTarget.z+_camOff.z);
  if(CAM.liftSnap){ CAM.liftSnap=false; CAM.lift=camLift(camBase, p); CAM.liftV=0; }
  CAM.lt=camLift(camBase, p); sd(CAM, 'lift', CAM.lt, CAM_FEEL.liftT, st); camBase.y+=CAM.lift;   // Z241 a great wall between the lens and the tank → rise over it, settle back when clear
  { const hy=heightAt(p.pos.x, p.pos.z)+(p.cav ? 1.6 : 3.2), yt=Math.max(camBase.y, camBase.y-CAM.lift+CAM.lt), hd=Math.hypot(camBase.x-p.pos.x, camBase.z-p.pos.z), o=CAM.occ ?? 1;   // Z337 a building between the lens and you (or the lens
    const t=Math.min(sightToBuildings(p.pos.x, hy, p.pos.z, camBase.x, yt, camBase.z), sightToRocks(p.pos.x, hy, p.pos.z, camBase.x, yt, camBase.z), sightToGround(p.pos.x, hy, p.pos.z, camBase.x, yt, camBase.z), sightToTrunks(p.pos.x, hy, p.pos.z, camBase.x, camBase.y, camBase.z));   // (NO-TANKS 10 a hill, a rock too — and judged from the height the lens is rising to: what the rise will clear, it does not also dive in for)
    let want=1, top=0; if(t<1){ const u=t-0.05; if(u*hd>=1.6) want=u; else top=1; } if(top) CAM.topT=now+CAM_FEEL.topHold; else if(now<(CAM.topT||0)) top=1;   // (NO-TANKS 10 held a moment: along a rock face it flicked up and down)   //   inside one): it comes in on its sight line to this side of the wall; with no room for it there (your back to the wall) it goes up over you
    CAM.occ = o+(want-o)*Math.min(1, dt*(want<o ? CAM_FEEL.occIn : 2.5)); CAM.top = (CAM.top||0)+(top-(CAM.top||0))*Math.min(1, dt*(top>(CAM.top||0) ? CAM_FEEL.topIn : 2));   // (NO-TANKS 10 in fast but gliding — it cut in a frame — and back out slowly)
    if(CAM.occ<0.999) camBase.set(p.pos.x+(camBase.x-p.pos.x)*CAM.occ, hy+(camBase.y-hy)*CAM.occ, p.pos.z+(camBase.z-p.pos.z)*CAM.occ);
    if(CAM.top>0.001){ const k=CAM.top, ty=hy+Math.max(9, camBase.y-hy), ux=(camBase.x-p.pos.x)/(hd||1), uz=(camBase.z-p.pos.z)/(hd||1); camBase.set(camBase.x+(p.pos.x-ux*1.8-camBase.x)*k, camBase.y+(ty-camBase.y)*k, camBase.z+(p.pos.z-uz*1.8-camBase.z)*k); } }   //   (high over you, a little out from the wall, looking down past the eaves)
  if(!underActive(p.pos.x)){ const g=heightAt(camBase.x, camBase.z)+0.9; if(camBase.y<g) camBase.y=g; }   // NO-TANKS 10 and never under the ground it is over
  camera.position.copy(camBase);
  steadyCam(camBase, camTarget.x, (CS.lookY+Math.max(0, 0.6-z)*2.2)*ck+CAM.ly+CAM.gy, camTarget.z, Math.max(10, camera.fov-Math.min(2, CAM.kick*1.4)*F.kick), camera.aspect, !(CAM.blend>0));   // Z382 the pose before the kick and the shake: the crosshair looks through it (combat/crosshair.js)
  const g=camShakeGain(), tr=Math.min(1, S.shake/3.2), t2=tr*tr*g;   // TRAUMA model: shake ∝ trauma² × the player's level (CÀI ĐẶT → RUNG MÀN HÌNH), a slow rumble, not a buzz
  if(t2>0.0004){ const q=now, A=SHAKE.pos*t2; camera.position.x += (Math.sin(q*31.1)+Math.sin(q*52.7+1.7)*0.45)*A; camera.position.y += (Math.sin(q*27.3+0.4)+Math.sin(q*47.9)*0.4)*A*0.55; camera.position.z += (Math.sin(q*35.9+2.1)+Math.sin(q*44.3)*0.45)*A; }
  CAM.kick += ((S.camKick||0) - CAM.kick)*(1-Math.exp(-dt*28));   // Z168 the shot shoves the camera back along the barrel (now eased in over a couple of frames, not a one-frame jump)
  { const k=CAM.kick*F.kick*(0.4+0.6*Math.min(1, g/SHAKE.levels.mid)); if(k>0.004){ const a=S.kickAng||0; camera.position.x -= Math.sin(a)*k*0.75; camera.position.z -= Math.cos(a)*k*0.75; camera.position.y += k*0.32; } }
  S.camKick=(S.camKick||0)*Math.exp(-dt*10);
  camera.lookAt(camTarget.x, (CS.lookY+Math.max(0, 0.6-z)*2.2)*ck+CAM.ly+CAM.gy, camTarget.z);   // Z171 the closest views aim at the hull, not its tracks
  { const want=CS.fov + CS.speedFov*Math.min(1, Math.hypot(p.vel.x, p.vel.z)/PLAYER.maxSpeed) + Math.min(2, CAM.kick*1.4)*F.kick, f=camera.fov+(want-camera.fov)*(1-Math.exp(-dt*F.fovEase));   // the lens breathes with speed, never steps
    if(CAM.blend>0){ CAM.blend=Math.max(0, CAM.blend-dt); const b=smoother(1-CAM.blend/F.resume);   // gliding home from a cinematic
      camera.position.lerpVectors(CAM.bp, camera.position, b); _q0.copy(camera.quaternion); camera.quaternion.slerpQuaternions(CAM.bq, _q0, b); camera.fov=CAM.bf+(f-CAM.bf)*b; camera.updateProjectionMatrix(); }
    else if(Math.abs(camera.fov-f)>0.005){ camera.fov=f; camera.updateProjectionMatrix(); } }
  if(t2>0.0004) camera.rotateZ((Math.sin(now*23.7)+Math.sin(now*41.3+0.9)*0.45)*t2*SHAKE.roll);   // roll
  if(p.cav && p.bike) rideCam(p, dt, now, g);   // Z301 on the ride: the camera feels the road
  gradePass.uniforms.aberr.value = t2*SHAKE.aberr;
  S.shake = Math.max(0, S.shake - dt*(S.shake*2.6 + 1.2));
}
