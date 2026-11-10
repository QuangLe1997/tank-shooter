// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BRIDGE } from '../../config.js';
import { S, TOWER, animateSoldier, bullets, cMod, campMats, diffDmgMul, fallers, floatText, heightAt, loopDmgMul, makeSoldierMesh, propTex, scene, sfx, spawnBullet, spawnPart } from '../hub.js';

// ===== Z90 · ROPE BRIDGES between paired watchtowers — plank walkway on a catenary, rope handrails, a sentry patrolling across; drop a tower and it snaps =====
export const BRIDGES=[];
export function buildBridge(a, b){
  const M=campMats(), y0=heightAt(a.x,a.z)+TOWER.h+0.12, y1=heightAt(b.x,b.z)+TOWER.h+0.12, dx=b.x-a.x, dz=b.z-a.z, D=Math.hypot(dx,dz), ux=dx/D, uz=dz/D;
  const s0=1.75, s1=D-1.75, L=s1-s0, sag=Math.min(1.1, L*0.06), yaw=Math.atan2(ux,uz);
  const ptAt=(u)=>{ const s=s0+u*L; return new THREE.Vector3(a.x+ux*s, y0+(y1-y0)*u - sag*4*u*(1-u), a.z+uz*s); };
  const halves=[new THREE.Group(), new THREE.Group()]; const anchors=[ptAt(0), ptAt(1)];
  halves.forEach((h,i)=>{ h.position.copy(anchors[i]); scene.add(h); });
  const nP=Math.round(L/0.42), wood=new THREE.MeshStandardMaterial({ map:propTex('wood'), color:0x8a6a44, roughness:0.92 }), pg=[[],[]];
  for(let k=0;k<nP;k++){ const u=(k+0.5)/nP, P=ptAt(u), hi=u<0.5?0:1, A=anchors[hi]; if(Math.random()<0.06) continue;   // the odd plank missing
    const pl=new THREE.BoxGeometry(1.25+Math.random()*0.15,0.07,0.32); pl.rotateY(yaw+(Math.random()-0.5)*0.08); pl.translate(P.x-A.x,P.y-A.y,P.z-A.z); pg[hi].push(pl); }
  pg.forEach((arr,i)=>{ if(!arr.length) return; const m=new THREE.Mesh(mergeGeometries(arr), wood); arr.forEach(q=>q.dispose()); m.castShadow=true; halves[i].add(m); });
  for(const side of [-1,1]) for(const [hy,i0] of [[1.05,0]]){ const ox=uz*side*0.7, oz=-ux*side*0.7;   // rope handrails + hangers, split at mid-span
    for(let hi=0;hi<2;hi++){ const A=anchors[hi], pts=[]; for(let k=0;k<=10;k++){ const u=hi? 0.5+k/20 : k/20, P=ptAt(u); pts.push(new THREE.Vector3(P.x+ox-A.x, P.y+hy+sag*0.5*4*u*(1-u)-A.y, P.z+oz-A.z)); }
      halves[hi].add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,0.03,4), M.rope));
      for(let k=1;k<10;k+=2){ const u=hi? 0.5+k/20 : k/20, P=ptAt(u), top=pts[k]; const hg=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,1,3), M.rope);
        const bx=P.x+ox-A.x, by=P.y-A.y, bz=P.z+oz-A.z; hg.position.set((bx+top.x)/2,(by+top.y)/2,(bz+top.z)/2); hg.scale.y=Math.max(0.1,top.y-by); halves[hi].add(hg); } } }
  const sentry=makeSoldierMesh({enemy:true}); sentry.scale.setScalar(1.55); scene.add(sentry);
  BRIDGES.push({ a, b, halves, anchors, ptAt, yaw, L, u:Math.random(), dir:1, sentry:{ g:sentry, alive:true, fireAt:performance.now()/1000+2 }, broken:false, bt:0 });
}
export function clearBridges(){ for(const br of BRIDGES){ br.halves.forEach(h=>scene.remove(h)); scene.remove(br.sentry.g); } BRIDGES.length=0; }
export const _bw=new THREE.Vector3();
export function updateBridges(dt, now){
  const p=S.player; if(!p) return;
  for(const br of BRIDGES){
    if(!br.broken && (br.a.falling||br.b.falling)){ br.broken=true; br.bt=0; br.fall=[br.a.falling?1:0, br.b.falling?1:0]; sfx('clang');   // a tower goes → the span snaps at the middle
      if(br.sentry.alive){ br.sentry.alive=false; const g=br.sentry.g; fallers.push({ g, t:0, vx:(Math.random()-0.5)*3, vy:2, vz:(Math.random()-0.5)*3, rx:(Math.random()<0.5?-1:1)*3, rz:(Math.random()-0.5)*4, down:false }); } }
    if(br.broken){ br.bt+=dt; const k=Math.min(1, br.bt/0.9);
      br.halves.forEach((h,i)=>{ const tw=i?br.b:br.a; if(tw.gone||br.fall[i]){ h.visible = br.bt<0.5 ? true : false; return; }   // the half on a felled tower goes with it
        const sgn=i?-1:1; h.rotation.set(0,0,0); h.rotateOnWorldAxis(new THREE.Vector3(Math.cos(br.yaw),0,-Math.sin(br.yaw)), sgn*-k*k*1.35); });   // the surviving half swings down and dangles
      continue; }
    const s=br.sentry; if(!s.alive) continue;
    br.u += br.dir*dt*BRIDGE.patrolSpeed/br.L; if(br.u>0.92){ br.u=0.92; br.dir=-1; } if(br.u<0.08){ br.u=0.08; br.dir=1; }
    const P=br.ptAt(br.u); s.g.position.set(P.x, P.y+0.05, P.z);
    const dx=p.pos.x-P.x, dz=p.pos.z-P.z, d=Math.hypot(dx,dz), aiming=d<TOWER.range;
    s.g.rotation.y = aiming ? Math.atan2(dx,dz) : br.yaw+(br.dir<0?Math.PI:0);
    let fired=false;
    if(aiming && now>=s.fireAt && S.mode==='playing'){ s.fireAt=now+TOWER.fireCd*(0.9+Math.random()*0.5); fired=true; s.g.userData.muzzle.getWorldPosition(_bw);
      const ang=Math.atan2(p.pos.x-_bw.x, p.pos.z-_bw.z)+(Math.random()-0.5)*0.1, dmg=(TOWER.guardDmg+S.stage*0.6)*loopDmgMul()*diffDmgMul()*cMod('enemyDmgMul');
      spawnBullet(_bw.x,_bw.z,ang,{owner:'e', dmg, speed:72, color:0xffb04a, r:0.24, life:1.4, maxDist:TOWER.range+4, arcDist:d, noArc:true, y:_bw.y, dropTo:1.4});
      spawnPart(_bw.x,_bw.y,_bw.z, Math.sin(ang)*5,-1,Math.cos(ang)*5, {tex:'flash', color:0xfff0c0, size:0.7, life:0.05, grav:0, drag:8}); sfx('enemyShoot', {x:_bw.x,z:_bw.z}); }
    animateSoldier(s.g, aiming?0:dt*BRIDGE.patrolSpeed/1.55, dt, fired);
    for(const b of bullets){ if(b.owner!=='p') continue; const q=(b.x-P.x)**2+(b.z-P.z)**2; if(q<0.9){ s.alive=false; b.life=-1; fallers.push({ g:s.g, t:0, vx:(Math.random()-0.5)*3, vy:3, vz:(Math.random()-0.5)*3, rx:3, rz:1, down:false }); floatText('✝','#ff9a7a',{x:P.x,y:P.y+2,z:P.z},16); break; } }   // a shot picks the sentry off the span
  }
}
