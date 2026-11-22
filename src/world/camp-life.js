// world/camp-life.js — Z196 A LIVED-IN BARRACKS: the troop camp is where the enemy feeds, clothes, treats and rests its men — a field mess
//   (open-sided mess tent, long tables + benches, a kitchen trailer with a smoking stove pipe, a water trailer), a quartermaster's tent
//   (racks of uniforms, stacked boxes), a medical tent with red crosses, cots under an awning and an ambulance, rest tents, washing
//   lines, latrines and showers — and it is full of men: eating, sitting round the fire, drilling on the parade ground, lying wounded,
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
function cot(K, x, z, ry){ K.add('wood', B3(0.75,0.06,2.0,x,0.5,z,ry), 0x6a6040); for(const s of [-0.85,0.85]) for(const t of [-0.3,0.3]) K.add('wood', B3(0.05,0.5,0.05,x+t*Math.cos(ry||0)+s*Math.sin(ry||0),0.25,z-t*Math.sin(ry||0)+s*Math.cos(ry||0)), 0x4a4030); }
// the field mess: open-sided tent on poles, two long tables with benches, a kitchen trailer and a water trailer
export function messHall(K, x, z){ const T=K.tent ? K.tent(x, z, 10, 7) : K;   // Z414 the tent (poles and canvas) apart from the tables under it: it burns, they stay
  for(const px of [-4.5,-1.5,1.5,4.5]) for(const pz of [-3,3]) T.add('wood', CY(0.07,0.07,2.7,6,x+px,1.35,z+pz), 0x6a5236);
  for(const s of [-1,1]) T.add('canvas', _xf(new THREE.BoxGeometry(10,0.05,3.6),x,3.05,z+s*1.6,s*0.32,0,0), 0x7c7a54);
  for(const tz of [-1.25,1.25]){ K.add('wood', B3(7.2,0.08,0.95,x,0.8,z+tz), 0x8a6a40); for(const lx of [-3.2,0,3.2]) K.add('wood', B3(0.08,0.76,0.8,x+lx,0.38,z+tz), 0x5a4428);
    for(const s of [-0.78,0.78]) K.add('wood', B3(7.0,0.06,0.32,x,0.46,z+tz+s), 0x7a5a36);
    for(let i=0;i<8;i++) K.add('metal', CY(0.13,0.11,0.06,8,x-3+i*0.85,0.87,z+tz+_R(-0.2,0.2)), 0x9a9a92); }   // mess tins
  const kx=x-7.6; K.add('paint', B3(2.4,1.5,1.7,kx,1.25,z), 0x56603a); K.add('metal', B3(2.0,0.06,1.4,kx,2.05,z), 0x3a3a36); wheelsK(K, [kx-1.0,kx+1.0], [z], 0.42);
  K.add('metal', CY(0.13,0.13,2.0,8,kx+0.6,3.0,z-0.3), 0x2a2826); K.add('metal', CY(0.32,0.28,0.5,10,kx-0.5,2.3,z+0.2), 0x6a6a64); K.add('metal', CY(0.32,0.28,0.5,10,kx-0.5,2.3,z-0.5), 0x6a6a64);   // stove pipe + cauldrons
  K.add('paint', _xf(new THREE.CylinderGeometry(0.75,0.75,2.2,14),x+7.4,1.3,z,0,0,Math.PI/2), 0x4e5a3a); wheelsK(K, [x+6.8,x+8.0], [z], 0.4);   // water trailer
  for(let i=0;i<6;i++) K.add('paint', B3(0.18,0.45,0.32,x+6.3+i*0.22,0.23,z+1.5), 0x3a4a2a); }   // jerrycans
// quartermaster: an olive tent, uniforms on racks, stacked boxes and bales
export function quartermaster(K, x, z){ frameTent(K, x, z, 7, 5, 0x6a6e48, 0x5a5e3c);
  for(const rz of [3.6,4.6]){ for(const s of [-2.6,2.6]) K.add('metal', CY(0.03,0.03,1.8,5,x+s,0.9,z+rz), 0x3a3a36); K.add('metal', CY(0.025,0.025,5.4,5,x,1.75,z+rz,0,Math.PI/2), 0x3a3a36);
    for(let i=0;i<9;i++){ const c=[0x5a6a3a,0x7a7050,0x4a5232,0x8a7a58][(i+rz*2)%4|0]; K.add('canvas', B3(0.48,0.75,0.07,x-2.3+i*0.58,1.3,z+rz), c); } }   // uniforms
  for(let i=0;i<5;i++) K.add('wood', B3(1.0,0.6,0.8,x+4.2,0.3+(i%3)*0.62,z-1.8+(i>2?1.0:0)), 0x6a5a38);   // boxes of kit
  for(let i=0;i<3;i++) K.add('canvas', B3(1.2,0.5,0.8,x-4.4,0.25+i*0.5,z-1.0), 0x8a7a58); }   // bales of clothing
// the medical post: a white tent with red crosses, cots under an awning, and an ambulance
export function medical(K, x, z){ const T=frameTent(K, x, z, 7, 5, 0xe6e4dc, 0xdcdad2);   // Z414 the crosses painted on it burn with it
  const cross=(cx,cy,cz,ry,s,k)=>{ (k||T).add('paint', B3(1.4*s,0.42*s,0.04,cx,cy,cz,ry), 0xc81e1e); (k||T).add('paint', B3(0.42*s,1.4*s,0.04,cx,cy,cz,ry), 0xc81e1e); };
  cross(x, 1.3, z+2.53, 0, 1); cross(x+3.53, 1.3, z, Math.PI/2, 0.9); cross(x-3.53, 1.3, z, Math.PI/2, 0.9);
  T.add('paint', _xf(new THREE.BoxGeometry(1.6,0.05,0.5),x,2.95,z+0.6,0.83,0,0), 0xc81e1e); T.add('paint', _xf(new THREE.BoxGeometry(0.5,0.05,1.6),x,2.95,z+0.6,0.83,0,0), 0xc81e1e);   // a cross on the roof
  { const W=K.tent ? K.tent(x, z+3.8, 7, 2.8) : K;   // Z417 the awning (poles and canvas) burns away like the tent; the cots under it stay
    for(const px of [-3.4,3.4]) W.add('metal', CY(0.04,0.04,2.3,5,x+px,1.15,z+5.2), 0x6a6a64); W.add('canvas', _xf(new THREE.BoxGeometry(7,0.04,2.8),x,2.25,z+3.8,-0.12,0,0), 0xd8d6ce); }   // awning
  for(const cx of [-2.4,0,2.4]) cot(K, x+cx, z+3.9, 0);
  const ax=x+7.2, az=z+2; K.add('metal', B3(1.2,0.35,6.4,ax,0.75,az), 0x2a2a28); K.add('paint', B3(2.3,1.9,2.0,ax,1.65,az+2.2), 0xe8e6de); K.add('paint', B3(2.4,2.3,3.8,ax,1.95,az-0.9), 0xe8e6de);   // ambulance
  K.add('metal', B3(2.0,0.7,0.05,ax,2.0,az+3.21), 0x1a2228); cross(ax+1.22, 2.1, az-0.9, Math.PI/2, 0.8, K); cross(ax-1.22, 2.1, az-0.9, Math.PI/2, 0.8, K);   /* (the ambulance's crosses stay with it) */ wheelsK(K, [ax-1.05,ax+1.05], [az+2.2,az-1.8], 0.45); }
// rest area: cots under a fly sheet + a washing line, latrines and showers with a water drum on top
export function restArea(K, x, z){ const T=K.tent ? K.tent(x, z, 6.8, 4.6) : K;   // Z417 the fly sheet (poles and canvas) in a kit of its own: it burns away like the mess tent, the cots stay
  for(const px of [-3,3]) for(const pz of [-2,2]) T.add('wood', CY(0.06,0.06,2.4,6,x+px,1.2,z+pz), 0x6a5236); T.add('canvas', B3(6.8,0.04,4.6,x,2.4,z), 0x6e6c4a);
  for(const cx of [-2.2,-0.7,0.8,2.3]) cot(K, x+cx, z, Math.PI/2*0+0);
  const lz=z+4.2; for(const s of [-3.5,3.5]) K.add('wood', CY(0.05,0.05,2.0,5,x+s,1.0,lz), 0x5a4428); K.add('metal', CY(0.01,0.01,7,3,x,1.85,lz,0,Math.PI/2), 0xb0b0a8);
  for(let i=0;i<9;i++) K.add('canvas', B3(0.5,0.62,0.03,x-3+i*0.72,1.5,lz), [0x5a6a3a,0xd8d0b8,0x7a7050,0x4a5232][i%4]); }   // washing on the line
export function latrines(K, x, z){ for(let i=0;i<4;i++){ const sx=x+i*1.35; K.add('wood', B3(1.2,2.3,1.2,sx,1.15,z), i<2?0x7a6a4a:0x6a7a6a); K.add('wood', B3(1.3,0.08,1.3,sx,2.33,z), 0x5a4a32); K.add('metal', B3(0.8,1.9,0.04,sx,1.0,z+0.62), 0x3a3428); }
  K.add('metal', CY(0.55,0.55,1.1,12,x+3.4,2.95,z), 0x3e4a32); }   // water drum on the shower roof
function wheelsK(K, xs, zs, r){ for(const x of xs) for(const z of zs) K.add('metal', CY(r,r,0.3,12,x,r,z,0,Math.PI/2), 0x1c1b1a); }

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
