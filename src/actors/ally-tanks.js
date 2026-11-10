// actors/ally-tanks.js — Z104 ALLIED TANKS: enemy tanks taken at a motor pool, driven by our soldiers. They pick their own fights
//   (armour first, then infantry), keep a stand-off range, regroup on you when the field is quiet, and can be knocked out.
import * as THREE from 'three';
import { ALLY_TANK, INFANTRY } from '../../config.js';
import { ARENA, S, TANK_SCALE, aiSteer, animateTank, bakeTank, blocks, boss, buildTank, camera, enemies, freeEnemyBar, getEnemyBar, heightAt, hitsHull, killEnemy, radio, scene, sfx, solidTank, spawnBullet, spawnPart, tankExplode, tankRecoil, wrapAngle } from '../hub.js';

export const ALLY_TANKS=[];
export const ALLY_PAL={ hull:0x55663a, turret:0x627344, barrel:0x7a8a52, tread:0x22281a, accent:0x9be04a };   // captured hull, our colours
const _am=new THREE.Vector3(), _ad=new THREE.Vector3();
export function spawnAllyTank(x, z, facing, heavy){
  const m=buildTank(ALLY_PAL); bakeTank(m); const sc=(heavy?1.15:1)*TANK_SCALE; m.scale.setScalar(sc); m.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); scene.add(m);
  const tur=m.userData.turret; if(tur){ const id=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.05,0.7), new THREE.MeshStandardMaterial({ color:0x9be04a, emissive:0x5fae1c, emissiveIntensity:0.8 })); id.position.set(0,0.62,-0.2); tur.add(id); }   // lime ID panel on the turret roof (air/ground recognition)
  const hp=Math.round(ALLY_TANK.hp*(heavy?1.6:1)*(1+(S.stage-1)*0.15)), bar=getEnemyBar(); bar.g.scale.setScalar(1.3);
  const t={ mesh:m, pos:new THREE.Vector3(x,0,z), vel:new THREE.Vector3(), facing, aim:facing, hp, maxHp:hp, r:1.5*(heavy?1.15:1), heavy:!!heavy, fireAt:performance.now()/1000+1.2, thinkAt:0, target:null, goal:null, kbx:0, kbz:0, bar };
  m.position.set(x,0,z); m.rotation.y=facing; ALLY_TANKS.push(t); radio('Kíp lái: Xe tăng chiến lợi phẩm đã sẵn sàng — tự tìm mục tiêu!'); return t; }
function pickTarget(t){ let best=null, bs=ALLY_TANK.sight;
  for(const e of enemies){ if(e.def.air) continue; const d=Math.hypot(e.pos.x-t.pos.x, e.pos.z-t.pos.z)*(solidTank(e)?0.8:1); if(d<bs){ bs=d; best=e; } }
  if(boss&&boss.alive){ const d=Math.hypot(boss.pos.x-t.pos.x, boss.pos.z-t.pos.z)*0.8; if(d<bs) best=boss; }
  return best; }
export function damageAllyTank(t, dmg){ if(t.dead) return; t.hp-=dmg; t.hitT=0.15; if(t.hp<=0) killAllyTank(t); }
function killAllyTank(t){ t.dead=true; const i=ALLY_TANKS.indexOf(t); if(i>=0) ALLY_TANKS.splice(i,1); if(t.bar){ freeEnemyBar(t.bar); t.bar=null; }
  tankExplode({x:t.pos.x,z:t.pos.z}, 0xff9a4a, t.heavy?1.9:1.6, ALLY_PAL, t.mesh.scale.x); scene.remove(t.mesh); radio('SCH: Một xe tăng đồng minh đã bị hạ!'); }
// enemy fire (bullet / missile / blast) that meets an allied hull — true if it hit
export function hitAllyTank(x, z, r, dmg){ for(const t of ALLY_TANKS){ const q=(t.pos.x-x)**2+(t.pos.z-z)**2; if(q < (r+t.r*2.2)**2 && hitsHull(t, x, z, r)){ damageAllyTank(t, dmg); return true; } } return false; }
export function blastAllyTanks(x, z, R, dmg){ for(const t of ALLY_TANKS.slice()){ const d=Math.hypot(t.pos.x-x, t.pos.z-z); if(d<R+t.r) damageAllyTank(t, dmg*(1-0.6*d/(R+t.r))); } }
// enemy tanks / infantry may pick one of ours when it is clearly closer than you
export function allyArmourNear(x, z, R){ let best=null, bd=R; for(const t of ALLY_TANKS){ const d=Math.hypot(t.pos.x-x, t.pos.z-z); if(d<bd){ bd=d; best=t; } } return best; }
export function clearAllyTanks(){ for(const t of ALLY_TANKS){ scene.remove(t.mesh); if(t.bar) freeEnemyBar(t.bar); } ALLY_TANKS.length=0; }
export function updateAllyTanks(dt, now){ const p=S.player; if(!p || !ALLY_TANKS.length) return; const A=ALLY_TANK;
  for(const t of ALLY_TANKS.slice()){
    if(now>=t.thinkAt){ t.thinkAt=now+0.5+Math.random()*0.2; t.target=pickTarget(t);
      const dp=Math.hypot(p.pos.x-t.pos.x, p.pos.z-t.pos.z);
      if(t.target && !(dp>A.leash && Math.hypot(t.target.pos.x-p.pos.x, t.target.pos.z-p.pos.z)>A.leash)){ const qx=t.target.pos.x-t.pos.x, qz=t.target.pos.z-t.pos.z, qd=Math.hypot(qx,qz)||1;
        t.goal = qd>A.keep+3 ? [t.target.pos.x-qx/qd*A.keep, t.target.pos.z-qz/qd*A.keep] : (qd<A.keep-5 ? [t.pos.x-qx/qd*6, t.pos.z-qz/qd*6] : null); }
      else { const side=(ALLY_TANKS.indexOf(t)%2?1:-1), bx=-Math.sin(p.facing), bz=-Math.cos(p.facing); t.target=t.target&&dp<A.leash?t.target:null;   // regroup: off your rear quarter
        const gx=p.pos.x+bx*10+bz*side*9, gz=p.pos.z+bz*10-bx*side*9; t.goal = Math.hypot(gx-t.pos.x, gz-t.pos.z)>5 ? [gx,gz] : null; } }
    // drive (steer round obstacles), turn the hull toward the travel direction
    let want=0; _ad.set(0,0,0); if(t.goal){ _ad.set(t.goal[0]-t.pos.x, 0, t.goal[1]-t.pos.z); const L=_ad.length(); if(L>1.5){ _ad.divideScalar(L); aiSteer(t, _ad); want=A.speed*(t.heavy?0.8:1)*Math.min(1, L/6); } }
    const df=want>0 ? wrapAngle(Math.atan2(_ad.x,_ad.z)-t.facing) : 0; t.facing=wrapAngle(t.facing+Math.sign(df)*Math.min(Math.abs(df), A.turn*dt));
    const fwd=want*Math.max(0, Math.cos(df)); const vx=Math.sin(t.facing)*fwd, vz=Math.cos(t.facing)*fwd;
    t.vel.x+=(vx-t.vel.x)*Math.min(1,dt*1.8); t.vel.z+=(vz-t.vel.z)*Math.min(1,dt*1.8);
    t.pos.x+=(t.vel.x+t.kbx)*dt; t.pos.z+=(t.vel.z+t.kbz)*dt; const kf=Math.max(0,1-dt*4); t.kbx*=kf; t.kbz*=kf;
    for(const b of blocks){ if(b.kind==='parked' && b.mesh===t.mesh) continue; const bx=t.pos.x-b.x, bz=t.pos.z-b.z, q=bx*bx+bz*bz, rr=(b.obb?Math.max(b.obb.hw,b.obb.hl):b.r)+t.r; if(q<rr*rr && q>1e-4){ const qq=Math.sqrt(q); t.pos.x=b.x+bx/qq*rr; t.pos.z=b.z+bz/qq*rr; } }
    const others=[p, ...ALLY_TANKS.filter(o=>o!==t), ...enemies.filter(solidTank)];
    for(const o of others){ const ox=t.pos.x-o.pos.x, oz=t.pos.z-o.pos.z, q=ox*ox+oz*oz, rr=t.r+(o.radius||o.r||1.5)+0.6; if(q<rr*rr && q>1e-4){ const qq=Math.sqrt(q), push=(rr-qq)*0.5; t.pos.x+=ox/qq*push; t.pos.z+=oz/qq*push; } }
    if(Math.hypot(t.vel.x,t.vel.z)>INFANTRY.crushSpeed) for(const e of enemies.slice()){ if(e.def.inf && hitsHull(t, e.pos.x, e.pos.z, 0.35)){ e._crushed=true; killEnemy(e); } }   // tracks run enemy infantry down
    const lim=ARENA-4; t.pos.x=Math.max(-lim,Math.min(lim,t.pos.x)); t.pos.z=Math.max(-lim,Math.min(lim,t.pos.z));
    // lay the gun on the target and fire when it is lined up
    const T=t.target; if(T && !enemies.includes(T) && T!==boss) t.target=null;
    const aimW = t.target ? Math.atan2(t.target.pos.x-t.pos.x, t.target.pos.z-t.pos.z) : t.facing; t.aim=wrapAngle(t.aim+wrapAngle(aimW-t.aim)*Math.min(1,dt*3));
    const tur=t.mesh.userData.turret; if(tur) tur.rotation.y=wrapAngle(t.aim-t.facing);
    if(t.target && now>=t.fireAt && Math.abs(wrapAngle(aimW-t.aim))<0.08 && S.mode==='playing'){ const d=Math.hypot(t.target.pos.x-t.pos.x, t.target.pos.z-t.pos.z);
      if(d<A.range){ t.fireAt=now+A.fireCd*(t.heavy?1.2:1)*(0.85+Math.random()*0.3); const mz=t.mesh.userData.muzzle; if(mz) mz.getWorldPosition(_am); else _am.set(t.pos.x,1.6,t.pos.z);
        const dmg=A.dmg*(t.heavy?1.5:1)*(1+(S.stage-1)*0.12);
        spawnBullet(_am.x, _am.z, t.aim+(Math.random()-0.5)*0.03, { owner:'p', dmg, speed:A.bspeed, color:0xc8f070, r:0.45, life:2, maxDist:A.range+2, noArc:true, y:_am.y, dropTo:1.2, type:'AP', fx:'blast', aoe:1.6, aoeDmg:dmg*0.5, knock:2 });
        tankRecoil(t.mesh, t.aim, t.heavy?0.9:0.7, t.facing); spawnPart(_am.x,_am.y,_am.z, Math.sin(t.aim)*7,1,Math.cos(t.aim)*7, {tex:'flash', color:0xfff0b0, size:1.2, life:0.08, grav:0, drag:7}); sfx('enemyShoot', t.pos); } }
    t.mesh.position.set(t.pos.x,0,t.pos.z); t.mesh.rotation.y=t.facing; animateTank(t.mesh, t.pos.x, t.pos.z, t.facing, dt);
    if(t.bar){ const f=Math.max(0,t.hp/t.maxHp), ms=t.mesh.scale.x||1; t.bar.g.position.set(t.pos.x, 2.7+ms*0.95+heightAt(t.pos.x,t.pos.z), t.pos.z); t.bar.g.quaternion.copy(camera.quaternion); t.bar.g.visible=true;
      t.bar.fill.scale.x=Math.max(0.001,f); t.bar.fill.position.x=-(1-f)*0.5; t.bar.fill.material.color.setHex(f>0.5?0x9be04a:(f>0.25?0xffcf5a:0xff5a4a)); } } }
