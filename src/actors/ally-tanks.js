// actors/ally-tanks.js — Z104 ALLIED TANKS: enemy tanks taken at a motor pool, driven by our soldiers. They pick their own fights
//   (armour first, then infantry), keep a stand-off range, regroup on you when the field is quiet, and can be knocked out.
import * as THREE from 'three';
import { ALLY_TANK, INFANTRY, HIJACK } from '../../config.js';
import { FORTS, FT, S, TANK_SCALE, addScore, aiSteer, animateTank, bakeTank, blocks, boss, buildTank, camera, clampField, damageEnemy, decorateEnemyMesh, enemies, floatText, fortSealed, freeEnemyBar, getEnemyBar, heightAt, hitsHull, killEnemy, makeLauncherMesh, radio, removeEnemy, ringPulse, scene, sfx, solidTank, spawnAlly, spawnBullet, spawnEnemy, spawnPart, tankExplode, tankRecoil, wrapAngle } from '../hub.js';

export const ALLY_TANKS=[];
export const ALLY_PAL={ hull:0x55663a, turret:0x627344, barrel:0x7a8a52, tread:0x22281a, accent:0x9be04a };   // captured hull, our colours
const _am=new THREE.Vector3(), _ad=new THREE.Vector3();
// the captured hull in our colours + a lime ID panel on the turret roof (air/ground recognition) — also used by the boot warm-up
export function makeAllyTankMesh(heavy, type){ let m;   // Z116 a hijacked vehicle keeps its shape (APC bed, shield, twin guns, rocket pod…) in our paint
  if(type==='launcher'){ m=makeLauncherMesh(ALLY_PAL); m.scale.setScalar(1.18*TANK_SCALE); }
  else { m=buildTank(ALLY_PAL); if(type && type!=='grunt'){ m.userData.palOverride=ALLY_PAL; m.userData.friendly=true; decorateEnemyMesh(m, type); } bakeTank(m); m.scale.setScalar((heavy?1.15:1)*(type==='carrier'?1.2:1)*TANK_SCALE); }
  m.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  const tur=m.userData.turret; if(tur){ const id=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.05,0.7), new THREE.MeshStandardMaterial({ color:0x9be04a, emissive:0x5fae1c, emissiveIntensity:0.8 })); id.position.set(0,0.62,-0.2); tur.add(id); }
  return m; }
export function spawnAllyTank(x, z, facing, heavy, type){
  const m=makeAllyTankMesh(heavy, type); scene.add(m); const kind = type==='carrier' ? 'apc' : type==='launcher' ? 'rocket' : 'tank';
  const hp=Math.round(ALLY_TANK.hp*(heavy?1.6:1)*(kind==='rocket'?0.6:1)*(1+(S.stage-1)*0.15)), bar=getEnemyBar(); bar.g.scale.setScalar(1.3);
  const t={ mesh:m, pos:new THREE.Vector3(x,0,z), vel:new THREE.Vector3(), facing, aim:facing, hp, maxHp:hp, r:1.5*(heavy?1.15:1)*(kind==='tank'?1:1.15), heavy:!!heavy, kind, type:type||null, fireAt:performance.now()/1000+1.2, thinkAt:0, target:null, goal:null, kbx:0, kbz:0, bar, burst:0 };
  m.position.set(x,0,z); m.rotation.y=facing; ALLY_TANKS.push(t);
  radio(kind==='apc' ? 'Kíp lái: Xe chở quân đã về tay ta — súng máy yểm trợ bộ binh!' : kind==='rocket' ? 'Kíp lái: Xe tên lửa đã về tay ta — ưu tiên bắn trực thăng, rồi nện vào thành!' : 'Kíp lái: Xe tăng chiến lợi phẩm đã sẵn sàng — tự tìm mục tiêu!'); return t; }
// ===== Z116 HIJACK — a badly hit enemy vehicle may be abandoned; drive up to it (or walk a soldier onto it) before it's scuttled =====
export function maybeAbandon(e){ if(e.abandoned || e.abandonTried || e.def.inf || e.def.air || e.commander || e.escortOf || e===boss) return; if(!HIJACK.types.includes(e.type)) return;
  if(e.hp > e.maxHp*HIJACK.hp) return; e.abandonTried=true; if(Math.random() > HIJACK.chance) return;
  const now=performance.now()/1000; e.abandoned=now+HIJACK.window; e.vel.set(0,0,0); e.fireAt=Infinity; e._hj=0; e.hold=null; e.exit=null; e.guard=null;
  for(let k=0;k<HIJACK.bail;k++){ const a=Math.random()*6.283, b=spawnEnemy('rifle', e.pos.x+Math.cos(a)*2.6, e.pos.z+Math.sin(a)*2.6); if(b && e.fortOf) b.fortOf=e.fortOf; }   // the crew bails out and fights on foot
  if(e.def.carrier && e.crew) for(const c of e.crew) if(c.alive && c.mesh) c.mesh.visible=false;
  floatText('XE BỎ — ÁP SÁT ĐỂ CƯỚP!', '#9be04a', new THREE.Vector3(e.pos.x, 4, e.pos.z), 17); sfx('clang'); radio('Kíp xe địch bỏ chạy — áp sát xe đó để cướp!'); }
export function abandonedTick(e, dt, now){ const p=S.player, gy=heightAt(e.pos.x,e.pos.z);
  e.vel.multiplyScalar(Math.max(0,1-dt*4)); e.pos.addScaledVector(e.vel, dt); e.mesh.position.set(e.pos.x,0,e.pos.z);
  if(Math.random()<dt*6) spawnPart(e.pos.x+(Math.random()-0.5)*1.4, gy+2.0, e.pos.z+(Math.random()-0.5)*1.4, 0.5, 1.6+Math.random(), 0.3, {color:0x2a2622, size:1.1, life:1.6, smoke:true, grav:0.3, drag:0.9, grow:1.4, op:0.45});   // engine smoking
  e._ringAt=(e._ringAt||0)-dt; if(e._ringAt<=0){ e._ringAt=0.8; ringPulse(e.pos, 0x9be04a, 3.2); }
  const dP=Math.hypot(p.pos.x-e.pos.x, p.pos.z-e.pos.z), foot=FT.some(a=>Math.hypot(a.pos.x-e.pos.x, a.pos.z-e.pos.z) < HIJACK.footR+e.r);
  if(dP < HIJACK.r+e.r || foot){ e._hj=(e._hj||0)+dt*(foot?2:1); if(((e._hj*4)|0)!==e._hjT){ e._hjT=(e._hj*4)|0; floatText('ĐANG CƯỚP '+Math.min(100,Math.round(e._hj/HIJACK.hold*100))+'%', '#9be04a', new THREE.Vector3(e.pos.x, gy+3.4, e.pos.z), 12); } }
  else e._hj=Math.max(0,(e._hj||0)-dt*0.5);
  if(e._hj>=HIJACK.hold) return captureVehicle(e);
  if(now>e.abandoned){ e._fx='fire'; e.abandoned=0; damageEnemy(e, e.hp+1); }   // too slow: they scuttle it
}
export function captureVehicle(e){ if(ALLY_TANKS.length>=ALLY_TANK.cap){ floatText('ĐỦ XE RỒI — TỐI ĐA '+ALLY_TANK.cap, '#ffcf5a', S.player.pos, 15); e._hj=0; return; }
  const x=e.pos.x, z=e.pos.z, f=e.facing, type=e.type; removeEnemy(e);
  const t=spawnAllyTank(x, z, f, type==='heavy', type); t.hp=Math.max(t.hp*HIJACK.keepHp, 40);
  if(t.kind==='apc') for(let k=0;k<HIJACK.apc.troops;k++){ const a=f+Math.PI+(k-1)*0.6, al=spawnAlly(x+Math.sin(a)*2.4, z+Math.cos(a)*2.4, a); if(al) al.thinkAt=0; }   // our men climb out of the bed
  ringPulse(new THREE.Vector3(x,0,z), 0x9be04a, 5); sfx('levelup'); floatText(type==='launcher'?'ĐÃ CƯỚP XE TÊN LỬA!':type==='carrier'?'ĐÃ CƯỚP XE CHỞ QUÂN!':'ĐÃ CƯỚP XE TĂNG ĐỊCH!', '#9be04a', new THREE.Vector3(x, 4.5, z), 22);
  addScore(300, new THREE.Vector3(x,3,z)); }
function pickTarget(t){ let best=null, bs=ALLY_TANK.sight;
  if(t.kind==='rocket'){ const R=HIJACK.rocket; for(const e of enemies){ if(!e.def.air || e.abandoned) continue; const d=Math.hypot(e.pos.x-t.pos.x, e.pos.z-t.pos.z); if(d<R.airR && d<bs){ bs=d; best=e; } } if(best) return best; bs=R.range; }   // Z116 AA first
  if(t.kind==='apc'){ for(const e of enemies){ if(!e.def.inf) continue; const d=Math.hypot(e.pos.x-t.pos.x, e.pos.z-t.pos.z); if(d<HIJACK.apc.range && d<bs){ bs=d; best=e; } } return best; }   // MG → infantry only
  for(const e of enemies){ if(e.def.air || e.abandoned) continue; const d=Math.hypot(e.pos.x-t.pos.x, e.pos.z-t.pos.z)*(solidTank(e)?0.8:1); if(d<bs){ bs=d; best=e; } }
  if(boss&&boss.alive){ const d=Math.hypot(boss.pos.x-t.pos.x, boss.pos.z-t.pos.z)*0.8; if(d<bs) best=boss; }
  return best; }
export function damageAllyTank(t, dmg){ if(t.dead) return; t.hp-=dmg; t.hitT=0.15; if(t.hp<=0) killAllyTank(t); }
function killAllyTank(t){ t.dead=true; const i=ALLY_TANKS.indexOf(t); if(i>=0) ALLY_TANKS.splice(i,1); if(t.bar){ freeEnemyBar(t.bar); t.bar=null; }
  tankExplode({x:t.pos.x,z:t.pos.z}, 0xff9a4a, t.heavy?1.9:1.6, ALLY_PAL, t.mesh.scale.x); scene.remove(t.mesh); radio('SCH: Một xe tăng đồng minh đã bị hạ!'); }
// Z116 weapons of hijacked vehicles: the APC's MG sprays infantry; the rocket truck shoots down helicopters, else hammers the nearest fortress gate/wall, else armour
const _rk=new THREE.Vector3();
function allyKindFire(t, now){ if(S.mode!=='playing' || now<t.fireAt) return; const mz=t.mesh.userData.muzzle;
  if(t.kind==='apc'){ const T=t.target, C=HIJACK.apc; if(!T || !enemies.includes(T)) return; const d=Math.hypot(T.pos.x-t.pos.x, T.pos.z-t.pos.z); if(d>C.range) return;
    if(mz) mz.getWorldPosition(_am); else _am.set(t.pos.x,1.8,t.pos.z); const a=Math.atan2(T.pos.x-_am.x, T.pos.z-_am.z)+(Math.random()-0.5)*0.06;
    spawnBullet(_am.x,_am.z,a,{ owner:'p', inf:true, dmg:C.dmg, speed:80, color:0xe8ef86, r:0.24, life:1.0, maxDist:C.range+2, noArc:true, y:_am.y, dropTo:1.2, from:t.pos }); sfx('rifleShot', t.pos);
    t.burst=(t.burst||C.burst)-1; if(t.burst>0) t.fireAt=now+C.gap; else { t.burst=C.burst; t.fireAt=now+C.pause; } return; }
  if(t.kind==='rocket'){ const R=HIJACK.rocket; let tx=null, tz=null, air=false, siege=null;
    if(t.target && enemies.includes(t.target) && t.target.def.air){ air=true; tx=t.target.pos.x; tz=t.target.pos.z; }
    else { let bd=R.siegeR; for(const f of FORTS){ if(f.captured || fortSealed(f) || !f.g) continue; const b = (!f.breached && f.gateShut) ? f.gate : f.pieces.find(pc=>!pc.down)?.block; if(!b) continue; const d=Math.hypot(b.x-t.pos.x, b.z-t.pos.z); if(d<bd){ bd=d; siege=b; } }
      if(siege){ tx=siege.x; tz=siege.z; } else if(t.target && enemies.includes(t.target)){ tx=t.target.pos.x; tz=t.target.pos.z; } }
    if(tx==null) return; t.fireAt=now+R.cd; const dmg=R.dmg*(1+(S.stage-1)*0.12);
    for(let k=0;k<R.salvo;k++) setTimeout(()=>{ if(S.mode!=='playing' || t.dead) return; if(mz) mz.getWorldPosition(_rk); else _rk.set(t.pos.x,2.4,t.pos.z);
      const gx=tx+(Math.random()-0.5)*2.4, gz=tz+(Math.random()-0.5)*2.4, a=Math.atan2(gx-_rk.x, gz-_rk.z), D=Math.hypot(gx-_rk.x, gz-_rk.z);
      if(air) spawnBullet(_rk.x,_rk.z,a,{ owner:'p', dmg, speed:60, color:0xffb060, r:0.4, life:2.5, maxDist:R.airR+10, y:_rk.y, lockOn:true, homing:5, rocket:true, type:'HE', aoe:R.aoe*0.7, aoeDmg:dmg*0.6, fx:'blast' });
      else spawnBullet(_rk.x,_rk.z,a,{ owner:'p', dmg:dmg*(siege?1.6:1), speed:34, color:0xffb060, r:0.45, life:4, arcDist:D, y:_rk.y, rocket:true, type:siege?'TBX':'HE', aoe:R.aoe, aoeDmg:dmg*0.8, fx:'blast' });   // lobbed: over the parapet onto the gate / wall
      spawnPart(_rk.x,_rk.y,_rk.z, 0,1.5,0, {color:0xd8d0c0, size:1.4, life:0.7, smoke:true, grav:0.3, drag:2, op:0.5}); sfx('rocketlaunch', t.pos); }, k*R.gap*1000); }
}
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
    clampField(t.pos, 4);
    // lay the gun on the target and fire when it is lined up
    const T=t.target; if(T && !enemies.includes(T) && T!==boss) t.target=null;
    const aimW = t.target ? Math.atan2(t.target.pos.x-t.pos.x, t.target.pos.z-t.pos.z) : t.facing; t.aim=wrapAngle(t.aim+wrapAngle(aimW-t.aim)*Math.min(1,dt*3));
    const tur=t.mesh.userData.turret; if(tur) tur.rotation.y=wrapAngle(t.aim-t.facing);
    if(t.kind!=='tank'){ allyKindFire(t, now); }   // Z116 MG carrier / rocket truck
    else if(t.target && now>=t.fireAt && Math.abs(wrapAngle(aimW-t.aim))<0.08 && S.mode==='playing'){ const d=Math.hypot(t.target.pos.x-t.pos.x, t.target.pos.z-t.pos.z);
      if(d<A.range){ t.fireAt=now+A.fireCd*(t.heavy?1.2:1)*(0.85+Math.random()*0.3); const mz=t.mesh.userData.muzzle; if(mz) mz.getWorldPosition(_am); else _am.set(t.pos.x,1.6,t.pos.z);
        const dmg=A.dmg*(t.heavy?1.5:1)*(1+(S.stage-1)*0.12);
        spawnBullet(_am.x, _am.z, t.aim+(Math.random()-0.5)*0.03, { owner:'p', from:t.pos, dmg, speed:A.bspeed, color:0xc8f070, r:0.45, life:2, maxDist:A.range+2, noArc:true, y:_am.y, dropTo:1.2, type:'AP', fx:'blast', aoe:1.6, aoeDmg:dmg*0.5, knock:2 });
        tankRecoil(t.mesh, t.aim, t.heavy?0.9:0.7, t.facing); spawnPart(_am.x,_am.y,_am.z, Math.sin(t.aim)*7,1,Math.cos(t.aim)*7, {tex:'flash', color:0xfff0b0, size:1.2, life:0.08, grav:0, drag:7}); sfx('enemyShoot', t.pos); } }
    t.mesh.position.set(t.pos.x,0,t.pos.z); t.mesh.rotation.y=t.facing; animateTank(t.mesh, t.pos.x, t.pos.z, t.facing, dt);
    if(t.bar){ const f=Math.max(0,t.hp/t.maxHp), ms=t.mesh.scale.x||1; t.bar.g.position.set(t.pos.x, 2.7+ms*0.95+heightAt(t.pos.x,t.pos.z), t.pos.z); t.bar.g.quaternion.copy(camera.quaternion); t.bar.g.visible=true;
      t.bar.fill.scale.x=Math.max(0.001,f); t.bar.fill.position.x=-(1-f)*0.5; t.bar.fill.material.color.setHex(f>0.5?0x9be04a:(f>0.25?0xffcf5a:0xff5a4a)); } } }
