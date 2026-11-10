// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import { ARC_G, TRUNNION_Z, _HAT, _rideH, wrapAngle } from '../hub.js';

// ---- living tank rig: track scroll + wheel spin (skid-steer aware), suspension pitch/roll, gun elevation, recoil + barrel shiver ----
export function animateTank(mesh, px, pz, facing, dt, ride){
  const ud=mesh.userData, rig=ud.rig; if(!rig || !(dt>0)) return; const heightAt = ride ? _rideH : _HAT;   // the player's hull also rides over rocks & rubble
  if(rig.lx===undefined || (px-rig.lx)**2+(pz-rig.lz)**2 > 36){ rig.lx=px; rig.lz=pz; rig.lf=facing; rig.v=0; }   // first frame / teleport (respawn, pooled reuse)
  const s=mesh.scale.x||1, dx=(px-rig.lx)/s, dz=(pz-rig.lz)/s; rig.lx=px; rig.lz=pz;
  const fs=Math.sin(facing), fc=Math.cos(facing), fwd=dx*fs+dz*fc;
  const dyaw=wrapAngle(facing-rig.lf); rig.lf=facing;
  const trav=[fwd+dyaw*1.18, fwd-dyaw*1.18];                                          // -x belt / +x belt (inner track slows in a turn)
  rig.treadD = (rig.treadD||0) + (Math.abs(fwd)+Math.abs(dyaw)*1.18)*s;                // ground covered → tread prints
  { const L=2.0*s, Wd=1.45*s, hf=heightAt(px+fs*L,pz+fc*L), hb=heightAt(px-fs*L,pz-fc*L), hr=heightAt(px+fc*Wd,pz-fs*Wd), hl=heightAt(px-fc*Wd,pz+fs*Wd);
    const tp=-Math.atan2(hf-hb,2*L), tr=Math.atan2(hr-hl,2*Wd), kk=Math.min(1,dt*9);
    rig.sp=(rig.sp==null?tp:rig.sp+(tp-rig.sp)*kk); rig.sr=(rig.sr==null?tr:rig.sr+(tr-rig.sr)*kk);
    const gy=(hf+hb+hr+hl)/4; rig.gy=(rig.gy==null?gy:rig.gy+(gy-rig.gy)*Math.min(1,dt*14));
    mesh.rotation.x=rig.sp; mesh.rotation.z=rig.sr; mesh.position.y=rig.gy; }                // hull rides over mounds & dips into craters
  for(let si=0;si<2;si++){ rig.tracks[si].offset.x += trav[si]*3.4; if(rig.wheelTex[si]) rig.wheelTex[si].rotation += (si?-1:1)*trav[si]/0.33; }
  // suspension: squat on acceleration, dive on braking, lean out of turns, idle engine shiver, terrain bumps when moving
  const v=fwd/dt, a=(v-rig.v)/dt; rig.v=v; rig.a += (a-rig.a)*Math.min(1,dt*10);
  const pT=Math.max(-0.075,Math.min(0.075,-rig.a*0.0022)), rT=Math.max(-0.05,Math.min(0.05,(dyaw/dt)*v*0.0016));
  rig.pv += ((pT-rig.pitch)*170 - rig.pv*13)*dt; rig.pitch += rig.pv*dt;
  rig.rv += ((rT-rig.roll)*170 - rig.rv*13)*dt;  rig.roll  += rig.rv*dt;
  rig.t += dt; const mv=Math.min(1,Math.abs(v)/12), body=ud.body;
  body.rotation.x = rig.pitch + Math.sin(rig.t*11.3)*0.006*mv; body.rotation.z = rig.roll + Math.sin(rig.t*8.7+1.3)*0.005*mv;
  body.position.y = 0.95 + Math.sin(rig.t*52)*0.0045 + Math.sin(rig.t*13.7)*0.012*mv;
  // gun: elevation toward the firing solution + recoil slide (fast back, smooth counter-recoil) + shiver after the shot
  const pv=ud.gunPivot, bg=ud.barrelG; if(!pv||!bg) return;
  rig.elev += (rig.elevT-rig.elev)*Math.min(1,dt*7);
  rig.recoil = Math.max(0, rig.recoil - dt*(rig.recoil*7.5+0.25));
  rig.vib = Math.max(0, rig.vib - dt*5.5);
  const sh=rig.vib*rig.vib;
  pv.rotation.x = -rig.elev + Math.sin(rig.t*71)*0.022*sh;
  pv.rotation.y = Math.sin(rig.t*57+0.7)*0.012*sh;
  bg.position.z = -TRUNNION_Z - rig.recoil*rig.recoilLen;
}
// fire kick: barrel slams back + shivers, hull rocks away from the shot (all tanks share this)
export function tankRecoil(mesh, aimWorld, kick, facing){
  const rig=mesh.userData.rig; if(!rig) return;
  rig.recoil=Math.min(1.2, Math.max(rig.recoil, kick)); rig.vib=Math.min(1, rig.vib+0.35+kick*0.5);
  const rel=aimWorld-(facing||0), k=kick*0.9;
  rig.pv -= Math.cos(rel)*k; rig.rv += Math.sin(rel)*k*0.7;                           // nose lifts when firing forward, rolls when firing over the side
}
// solve the visual barrel elevation for a ballistic lob of distance D at muzzle speed sp (matches spawnBullet's arc)
export function aimElevation(D, sp){ if(!(D>11) || !(sp>0)) return 0; const T=Math.min(0.9, D/sp), vy=Math.min(30, ARC_G*T/2); return Math.min(0.2, Math.atan2(vy, sp)*0.45); }
