// world/camp-life.js — Z196 A LIVED-IN BARRACKS: the troop camp is where the enemy feeds, clothes and treats its men — the mess tent, the
//   quartermaster's tent and the medical tent with red crosses (Z429 each worn by its real tent; Z434 the drawn tables, trailers, racks, cots,
//   ambulance, rest area and latrines gone) — and it is full of men: eating, sitting round the fire, drilling on the parade ground, lying wounded,
//   walking between the tents, a sentry pacing. When the alarm goes up they drop everything and run for the barracks (and come back out armed).
import * as THREE from 'three';
import { HUMAN_SCALE } from '../../config.js';
import { MOBILE, S, _R, _xf, animateSoldier, heightAt, makeSoldierMesh, scene } from '../hub.js';

export const CROWD=[];
const B3=(w,h,d,x,y,z,ry)=>_xf(new THREE.BoxGeometry(w,h,d),x,y,z,0,ry||0,0), CY=(rt,rb,h,s,x,y,z,rx,rz)=>_xf(new THREE.CylinderGeometry(rt,rb,h,s),x,y,z,rx||0,0,rz||0);
// a frame tent: walls, a gable roof (a triangular prism) and a dark door — w along x, d along z, door on +z
export function frameTent(K, x, z, w, d, col, roofCol){ K=K.tent ? K.tent(x, z, w+0.3, d+0.4) : K; K.add('canvas', B3(w,2.1,d,x,1.05,z), col);   // Z414 in a kit of its own when the camp asks (world/camps.js: a tent block that burns)
  const tri=new THREE.Shape(); tri.moveTo(-d/2-0.2,0); tri.lineTo(d/2+0.2,0); tri.lineTo(0,1.3); tri.closePath(); const pr=new THREE.ExtrudeGeometry(tri,{ depth:w+0.3, bevelEnabled:false }); pr.translate(0,0,-(w+0.3)/2); pr.rotateY(Math.PI/2); _xf(pr,x,2.1,z);
  K.add('canvas', pr, roofCol||col); K.add('metal', B3(1.4,1.8,0.04,x,0.9,z+d/2+0.02), 0x1e1c18); return K; }
// the field mess: open-sided tent on poles (Z434 its drawn tables, kitchen and water trailers gone)
export function messHall(K, x, z){ const T=K.tent ? K.tent(x, z, 10, 7) : K;   // Z414 the tent (poles and canvas) apart from the tables under it: it burns, they stay
  for(const px of [-4.5,-1.5,1.5,4.5]) for(const pz of [-3,3]) T.add('wood', CY(0.07,0.07,2.7,6,x+px,1.35,z+pz), 0x6a5236);
  for(const s of [-1,1]) T.add('canvas', _xf(new THREE.BoxGeometry(10,0.05,3.6),x,3.05,z+s*1.6,s*0.32,0,0), 0x7c7a54);
}   // Z434 no tables, kitchen trailer, water trailer or jerrycans drawn round it: the real mess tent stands alone
// quartermaster: an olive tent
export function quartermaster(K, x, z){ frameTent(K, x, z, 7, 5, 0x6a6e48, 0x5a5e3c); }   // Z434 no drawn racks of uniforms, boxes or bales
// the medical post: a white tent with red crosses (Z434 the awning, cots and drawn ambulance gone)
export function medical(K, x, z){ const T=frameTent(K, x, z, 7, 5, 0xe6e4dc, 0xdcdad2);   // Z414 the crosses painted on it burn with it
  const cross=(cx,cy,cz,ry,s,k)=>{ (k||T).add('paint', B3(1.4*s,0.42*s,0.04,cx,cy,cz,ry), 0xc81e1e); (k||T).add('paint', B3(0.42*s,1.4*s,0.04,cx,cy,cz,ry), 0xc81e1e); };
  cross(x, 1.3, z+2.53, 0, 1); cross(x+3.53, 1.3, z, Math.PI/2, 0.9); cross(x-3.53, 1.3, z, Math.PI/2, 0.9);
  T.add('paint', _xf(new THREE.BoxGeometry(1.6,0.05,0.5),x,2.95,z+0.6,0.83,0,0), 0xc81e1e); T.add('paint', _xf(new THREE.BoxGeometry(0.5,0.05,1.6),x,2.95,z+0.6,0.83,0,0), 0xc81e1e);   // a cross on the roof
}   // Z434 no drawn awning, cots or ambulance beside it

// ---------- the men ----------
// one man in the camp: lx/lz in camp-local metres, ly height above the ground, ry his heading (camp-local), pose: stand / sit / lie / walk / guard / drill
export function person(camp, lx, lz, ry, pose, o){ const g=makeSoldierMesh({ enemy:true }), u=g.userData, [x,z]=camp.at(lx,lz); g.scale.setScalar(HUMAN_SCALE);
  g.position.set(x, heightAt(x,z)+((o&&o.y)||0), z); g.rotation.y=camp.ang+(ry||0); scene.add(g);
  if(pose!=='guard' && pose!=='drill') u.gun.visible=false;   // off duty: no rifle in hand
  if(pose==='sit'){ for(const l of u.legs){ l.hip.rotation.x=-1.5; l.knee.rotation.x=1.5; } u.body.position.y=-0.36; u.arms.rotation.x=-0.75; }
  else if(pose==='lie'){ u.body.rotation.x=-Math.PI/2; u.body.position.y=0.1; u.arms.rotation.x=0.2; }
  else if(pose==='drill'){ u.arms.rotation.x=-0.1; }
  const P={ g, camp, pose, t:Math.random()*10, path:o&&o.path ? o.path.map(([a,b])=>camp.at(a,b)) : null, pi:0, run:false };
  CROWD.push(P); return P; }
export function clearCrowd(camp){ for(let i=CROWD.length-1;i>=0;i--){ const P=CROWD[i]; if(camp && P.camp!==camp) continue; scene.remove(P.g); CROWD.splice(i,1); } }
// the alarm: everyone off duty drops what he is doing and runs for the barracks door (the camp then sends them out armed)
export function scrambleCrowd(camp){ for(const P of CROWD){ if(P.camp!==camp || P.run) continue; P.run=true; P.path=[camp.door]; P.pi=0;
  const u=P.g.userData; for(const l of u.legs){ l.hip.rotation.x=0; l.knee.rotation.x=0; } u.body.rotation.x=0; u.body.position.y=0; } }
export function updateCrowd(dt){ const p=S.player; if(!p || !CROWD.length) return;
  for(let i=CROWD.length-1;i>=0;i--){ const P=CROWD[i], g=P.g; P.t+=dt;
    const far=(g.position.x-p.pos.x)**2+(g.position.z-p.pos.z)**2 > (MOBILE?70:100)**2; if(far && !P.run) continue;   // nobody far off is animated
    if(P.path){ const tgt=P.path[P.pi], dx=tgt[0]-g.position.x, dz=tgt[1]-g.position.z, d=Math.hypot(dx,dz), sp=P.run?5.2:(P.pose==='guard'?1.3:1.5);
      if(d<0.6){ if(P.run){ scene.remove(g); CROWD.splice(i,1); continue; } P.pi=(P.pi+1)%P.path.length; continue; }
      const st=Math.min(d, sp*dt); g.position.x+=dx/d*st; g.position.z+=dz/d*st; g.position.y=heightAt(g.position.x,g.position.z);
      const want=Math.atan2(dx,dz); let da=want-g.rotation.y; da=Math.atan2(Math.sin(da),Math.cos(da)); g.rotation.y+=da*Math.min(1,dt*6); animateSoldier(g, st, dt, false); }
    else if(P.pose==='stand' || P.pose==='drill' || P.pose==='guard') animateSoldier(g, 0, dt, false);   // idle: breathing, looking round
    else if(P.pose==='sit' && P.t>2+Math.random()*30){ P.t=0; g.userData.arms.rotation.x=-0.75+(Math.random()<0.5?-0.5:0); } }   // eating: a spoon to the mouth now and then
  }
