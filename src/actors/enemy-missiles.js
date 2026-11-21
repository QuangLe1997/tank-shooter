// actors/enemy-missiles.js — ENEMY ROCKETS & GUIDED MISSILES — real objects in flight: dodge them, SHOOT THEM DOWN, or blind them with smoke
import * as THREE from 'three';
import { EQUIP } from '../../config.js';
import { ARENA, GLOW, S, UNDER, addScore, apsIntercept, bigExplode, blastAllies, blastAllyTanks, blocksNear, bullets, core, damageBlock, damageCore, damagePlayer, damageSoldier, decalScorch, dropBeam, enemies, floatText, heightAt, hitAllyTank, inBlock, inSmoke, missileBoost, recycleBullet, scene, sfx, soldiers, spawnPart, wallMark, wrapAngle, MODE, blRamp, blSolid, holoRing, dressRound } from '../hub.js';

// ===== ENEMY ROCKETS & GUIDED MISSILES — real objects in flight: dodge them, SHOOT THEM DOWN, or blind them with smoke =====
export const EMIS=[], _emPool=[]; const _mbk=[];
export let _emMats=null;
export function makeEnemyRocket(){
  if(!_emMats) _emMats={ body:new THREE.MeshStandardMaterial({color:0x4a5034,roughness:0.55,metalness:0.5}), war:new THREE.MeshStandardMaterial({color:0x2a2a24,roughness:0.5,metalness:0.6}),
    glow:new THREE.SpriteMaterial({map:GLOW,color:0xffb060,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false}) };
  const g=new THREE.Group();
  const b=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,0.9,10), _emMats.body); b.rotation.x=Math.PI/2; g.add(b);
  const n=new THREE.Mesh(new THREE.ConeGeometry(0.2,0.5,10), _emMats.war); n.rotation.x=Math.PI/2; n.position.z=0.68; g.add(n);
  const body=[b, n]; for(let k=0;k<4;k++){ const f=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.34,0.24), _emMats.war); f.position.z=-0.38; f.rotation.z=k*Math.PI/2; f.position.x=Math.sin(k*Math.PI/2)*0.12; f.position.y=Math.cos(k*Math.PI/2)*0.12; g.add(f); body.push(f); }
  const s=new THREE.Sprite(_emMats.glow); s.scale.setScalar(1.3); s.position.z=-0.6; g.add(s);
  if(!_emMats.tongue) _emMats.tongue=new THREE.MeshBasicMaterial({ color:0xffa040, transparent:true, opacity:0.8, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide });   // Z188 a visible flame tongue
  const t=new THREE.Mesh(new THREE.ConeGeometry(0.13,1.3,10,1,true), _emMats.tongue); t.rotation.x=-Math.PI/2; t.position.z=-1.1; g.add(t); g.userData.tongue=t;
  const bc=new THREE.Mesh(new THREE.SphereGeometry(0.07,8,6), new THREE.MeshBasicMaterial({ color:0xff2a1a })); bc.position.set(0,0.16,0.2); g.add(bc); g.userData.beacon=bc;   // seeker beacon (blinks on guided rounds)
  g.userData.body=body; dressRound(g, 1.45);   // Z424 the missile scan for its body
  g.rotation.order='YXZ'; scene.add(g); return g;
}
export function launchEnemyMissile(x, y, z, ang, o){
  const m=_emPool.pop()||makeEnemyRocket(); m.visible=true; m.scale.setScalar(o.kind==='atgm'?1.35:(o.kind==='heli'?0.9:1));
  EMIS.push({ m, x, y, z, ang, pitch:0, speed:o.speed, dmg:o.dmg, aoe:o.aoe||2.5, guided:o.guided||0, life:o.life||3, kind:o.kind||'rpg', vy:o.vy||0, T:o.T||0, wire:o.wire||null, src:o.src||null,
    jam: !!(o.guided && S.player && S.player.sig && Math.random() < S.player.sig.shtora) });   // Z161 SHTORA: this one has lost you
  sfx('rocketlaunch', {x,z});
}
export function blowMissile(i, how){
  const r=EMIS[i], now=performance.now()/1000, gy=heightAt(r.x,r.z);
  if(how==='shot'){ bigExplode({x:r.x,z:r.z}, 0xffd27a, 0.7); floatText('ĐÃ ĐÁNH CHẶN', '#9fe8ff', {x:r.x,y:gy+2.6,z:r.z}, 15); addScore(40, new THREE.Vector3(r.x,2,r.z)); }
  else { bigExplode({x:r.x,z:r.z}, 0xff8a3a, r.aoe/3); decalScorch(r.x, r.z, r.aoe*0.6, 0.8);
    if(how!=='direct'){ const p=S.player, dd=Math.hypot(p.pos.x-r.x, p.pos.z-r.z); if(dd<r.aoe+p.radius) damagePlayer(r.dmg*0.55*(1-dd/(r.aoe+p.radius)*0.6), now, p.pos.x-r.x, p.pos.z-r.z); }
    for(const s of soldiers.slice()) if(Math.hypot(s.pos.x-r.x,s.pos.z-r.z)<r.aoe) damageSoldier(s, r.dmg*0.6);
    blastAllies(r.x, r.z, r.aoe, r.dmg*0.6); if(how!=='hit') blastAllyTanks(r.x, r.z, r.aoe, r.dmg*0.45); }
  if(r.wire){ dropBeam(r.wire); r.wire=null; }
  r.m.visible=false; _emPool.push(r.m); EMIS.splice(i,1);
  if(!EMIS.length && _lw) _lw.g.visible=false;
}
export function updateEnemyMissiles(dt, now){
  const p=S.player; if(!p) return; const smoked = inSmoke(now);
  for(let i=EMIS.length-1;i>=0;i--){ const r=EMIS[i]; r.life-=dt;
    const gy=heightAt(r.x,r.z);
    if(r.guided && !smoked && !r.jam){ const want=Math.atan2(p.pos.x-r.x, p.pos.z-r.z); r.ang=wrapAngle(r.ang + Math.max(-r.guided*dt, Math.min(r.guided*dt, wrapAngle(want-r.ang)))); r.y += ((gy+1.5)-r.y)*Math.min(1,dt*2.5); }
    else if(r.guided && (smoked || r.jam)){ r.ang += Math.sin(now*9+i)*dt*1.6; r.y += Math.sin(now*7+i)*dt*1.2; }    // SMOKE: the seeker loses you — it wobbles off course
    else { r.vy -= 4*dt; r.y += r.vy*dt; }
    const sx=Math.sin(r.ang), sz=Math.cos(r.ang), spd=missileBoost(r, dt); r.x+=sx*spd*dt; r.z+=sz*spd*dt;   // Z228b booster kick, then the motor
    r.m.position.set(r.x, r.y, r.z); r.m.rotation.y=r.ang; r.m.rotation.x=-Math.atan2(r.vy||0, r.speed)*0.6;
    spawnPart(r.x-sx*0.9, r.y, r.z-sz*0.9, (Math.random()-0.5)*0.6, 0.3, (Math.random()-0.5)*0.6, {color:0xd8cfbe, size:0.85, life:1.2, smoke:true, grav:-0.1, drag:1.4, grow:2.2, op:0.5});   // Z188 a thick smoke ribbon
    spawnPart(r.x-sx*0.8, r.y, r.z-sz*0.8, -sx*4, 0, -sz*4, {color:0xfff0b0, color2:0xff4a10, size:0.6, life:0.14, grav:0, drag:4});
    { const u=r.m.userData; if(u.tongue){ const f=0.8+Math.random()*0.45; u.tongue.scale.set(1,f,1); } if(u.beacon) u.beacon.visible = !!r.guided && Math.floor(now*10)%2===0; }
    if(r.wire){ r.wire.visible=true; const s0=r.src; if(s0&&enemies.includes(s0)){ const L=r.wire.geometry.attributes.position; L.setXYZ(0,s0.pos.x,heightAt(s0.pos.x,s0.pos.z)+1.9,s0.pos.z); L.setXYZ(1,r.x,r.y,r.z); L.needsUpdate=true; } else r.wire.visible=false; }
    let gone=null;
    for(let j=bullets.length-1;j>=0;j--){ const b=bullets[j]; if(b.owner!=='p') continue; if((b.x-r.x)**2+(b.z-r.z)**2 < (b.r+0.85)**2){ if(b.pierce>0) b.pierce--; else recycleBullet(j); gone='shot'; break; } }   // SHOOT IT DOWN
    if(!gone && p.apsCharges>0 && now<(p.apsUntil||0) && Math.hypot(r.x-p.pos.x, r.z-p.pos.z) < EQUIP.aps.radius){ apsIntercept(r.x, r.y, r.z); gone='shot'; }   // APS hard-kill
    if(!gone && p.sig && p.sig.trophy && now>(p.apsCd||0) && Math.hypot(r.x-p.pos.x, r.z-p.pos.z) < 7){ p.apsCd=now+p.sig.trophy; apsIntercept(r.x, r.y, r.z); gone='shot'; }   // Z161 TROPHY APS (Merkava)
    if(!gone && MODE.hitTest(p, r.x, r.z, 0.3) && r.y < gy+3.2){ damagePlayer(r.dmg, now, sx, sz); gone='direct'; }
    if(!gone && r.y < gy+3.2 && hitAllyTank(r.x, r.z, 0.3, r.dmg)) gone='hit';   // Z104 RPG / ATGM into a captured tank
    if(!gone) for(const bl of blocksNear(r.x, r.z, 0.3, _mbk)){ if(inBlock(bl, r.x, r.z, 0.3)){ if(bl.kind!=='obj' && !bl.supply) damageBlock(bl, r.dmg*1.2); wallMark(bl, r.x, r.y, r.z, -Math.sin(r.ang), -Math.cos(r.ang), 2.0, true); gone='hit'; break; } }
    if(!gone && core && Math.hypot(core.pos.x-r.x, core.pos.z-r.z) < core.r){ damageCore(r.dmg*0.8); gone='hit'; }
    if(!gone && (r.y<=gy+0.2 || r.life<=0 || (!UNDER.on && (Math.abs(r.x)>ARENA || Math.abs(r.z)>ARENA)))) gone='ground';
    if(gone) blowMissile(i, gone);
  }
}
// Z188 MISSILE LOCK WARNING — while a guided missile is hunting you, red brackets clamp round your tank with "BỊ KHOÁ", beeping faster as it closes
// Z318 battle light: solid HDR-red brackets, a danger ring with a radar sweep round the hull (was a stray triangle), one smooth pulse that quickens
//   warn → critical as the missile closes; the "BỊ KHOÁ" words moved off the battlefield onto the HUD (a sprite over the tank sat mid-screen on the action)
let _lw=null;
function lockWarnFX(){ if(_lw) return _lw; const g=new THREE.Group(), br=new THREE.Group();
  for(let c=0;c<4;c++){ const sx=c&1?-1:1, sz=c<2?1:-1, h=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.08,0.14),blSolid('danger',2.4,{ opacity:0.8 })), v=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.08,1.1),blSolid('danger',2.4,{ opacity:0.8 })); h.position.set(sx*2.55,0,sz*3.1); v.position.set(sx*3.1,0,sz*2.55); br.add(h,v); }
  const ring=holoRing(4.3, { kind:'danger', fill:0.9, ticks:36, tickLen:0.3, sweep:0.55 }); g.add(br, ring);
  g.traverse(o=>{ o.renderOrder=22; }); g.visible=false; scene.add(g);
  const el=document.createElement('div'); el.id='lockAlert'; el.className='bl-warn'; el.innerHTML='<i></i><b>BỊ KHOÁ</b><span></span>'; document.body.appendChild(el);
  _lw={ g, br, ring, el, at:0, txtAt:0 }; return _lw; }
export function updateLockWarn(dt, now){ const p=S.player; if(!p) return; let near=1e9;
  for(const r of EMIS){ if(!r.guided || r.jam) continue; const d=Math.hypot(r.x-p.pos.x, r.z-p.pos.z); if(d<near) near=d; }
  const on=near<75, W=on||_lw ? lockWarnFX() : null; if(!W) return; W.g.visible=on && !!MODE.rings; W.el.classList.toggle('on', on); if(!on) return;   // (Z403 a soldier's war: the HUD and the beeps, no ring on the ground)
  const k=Math.max(0, Math.min(1, 1-near/75)); W.g.position.set(p.pos.x, heightAt(p.pos.x,p.pos.z)+0.4, p.pos.z);
  W.br.scale.setScalar(1.2-0.2*k); W.br.rotation.y=p.facing||0; W.ring.rotation.z+=dt*(0.4+k*0.9);   // Z190 calmer
  const pul=blRamp(W, dt, k, 'warn', 'crit', 0.35); for(const m of W.br.children) m.material.opacity=0.3+0.62*pul; W.ring.material.opacity=0.4+0.6*pul;
  W.el.classList.toggle('crit', k>0.6); if(now>W.txtAt){ W.txtAt=now+0.2; W.el.lastChild.textContent='TÊN LỬA '+Math.round(near)+' m'; }
  if(now>W.at){ W.at=now+0.9-0.45*k; sfx('lockwarn'); } }
export function clearEnemyMissiles(){ if(_lw){ _lw.g.visible=false; _lw.el.classList.remove('on'); } for(const r of EMIS){ r.m.visible=false; _emPool.push(r.m); if(r.wire) dropBeam(r.wire); } EMIS.length=0; }
