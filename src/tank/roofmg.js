// tank/roofmg.js — Z167 ROOF MACHINE GUN: a pintle MG on the turret roof, worked by the crewman standing in the hatch — 360° traverse, elevation onto towers,
//   trigger-disciplined bursts at infantry only, belt boxes swapped by hand, brass + link pouring off the receiver; the next rider takes over when he falls.
import * as THREE from 'three';
import { ROOF_MG, ROOF_MG_BLOCK, ROOF_MG_UP } from '../../config.js';
import { PROFILE, RIDER, S, animateSoldier, canAfford, econBuy, enemies, floatText, riders, saveProfile, sfx, shootGuard, spawnBullet, spawnPart, towers, wrapAngle } from '../hub.js';

export const MGR = { on:false, mesh:null, parts:null, id:null, stat:null, yaw:0, pitch:0, ammo:0, reloadUntil:0, reloadDur:1, swapUntil:0, gunner:null,
  tgt:null, tgtAt:0, shotT:0, burst:0, pauseUntil:0, kick:0, owner:null, hud:null, shots:0 };
// ---------------- ownership, pick, upgrades (the PKT comes with every tank) ----------------
export function mgOwned(){ if(!Array.isArray(PROFILE.ownedMgs)) PROFILE.ownedMgs=[]; if(!PROFILE.ownedMgs.includes('pkt')) PROFILE.ownedMgs.unshift('pkt'); return PROFILE.ownedMgs; }
export function mgPicked(){ const o=mgOwned(); return o.includes(PROFILE.mgPick) ? PROFILE.mgPick : 'pkt'; }
export function mgLevels(id){ const U=PROFILE.mgUp&&typeof PROFILE.mgUp==='object' ? PROFILE.mgUp : (PROFILE.mgUp={}); const L=U[id]||(U[id]={}); for(const t of ROOF_MG_UP) L[t.key]=Math.max(0, Math.min(t.cost.length, L[t.key]|0)); return L; }
export function mgStats(id){ const D=ROOF_MG.find(m=>m.id===id)||ROOF_MG[0], L=mgLevels(D.id), f=k=>ROOF_MG_UP.find(t=>t.key===k).fx*(L[k]|0);
  return { ...D, dmg:D.dmg*(1+f('dmg')), rof:D.rof*(1+f('rof')), mag:Math.round(D.mag*(1+f('mag'))), reload:D.reload*(1-f('rel')) }; }
export function mgBlocked(p){ const g=p && p.guns && p.guns[p.gunIdx]; return !!(g && ROOF_MG_BLOCK.includes(g.id)); }

// ---------------- the gun itself: pintle, cradle, receiver, barrel, flash hider, belt box, spade grips, shield ----------------
const _m={}; const mat=(k,o)=>_m[k]||(_m[k]=new THREE.MeshStandardMaterial(o));
function buildMG(D){ const heavy=D.cal>10, s=heavy?1.18:1, root=new THREE.Group(), add=(par,geo,m,x,y,z)=>{ const o=new THREE.Mesh(geo,m); o.position.set(x,y,z); o.castShadow=true; par.add(o); return o; };
  const steel=mat('st',{ color:0x2a2c2e, roughness:0.45, metalness:0.85 }), dark=mat('dk',{ color:0x161718, roughness:0.6, metalness:0.6 }), olive=mat('ol',{ color:0x4a5234, roughness:0.75, metalness:0.3 }), brass=mat('br',{ color:0xb8892e, roughness:0.35, metalness:0.9 });
  add(root, new THREE.TorusGeometry(0.34,0.035,6,24), steel, 0,0.02,0).rotation.x=Math.PI/2;   // hatch ring
  add(root, new THREE.CylinderGeometry(0.3,0.33,0.06,20), dark, 0,0.0,0);
  const post=add(root, new THREE.CylinderGeometry(0.035,0.045,0.34,10), steel, 0,0.18,0.28);   // pintle
  const yawG=new THREE.Group(); yawG.position.set(0,0.36,0.28); root.add(yawG);
  add(yawG, new THREE.BoxGeometry(0.1,0.08,0.18), steel, 0,0,0);                                 // cradle
  if(D.id!=='pkt'){ const sh=add(yawG, new THREE.BoxGeometry(0.62*s,0.36*s,0.03), olive, 0,0.12,0.2); sh.rotation.x=-0.12;   // gun shield with a slot for the barrel
    add(yawG, new THREE.BoxGeometry(0.1,0.1,0.035), dark, 0,0.06,0.215); }
  const pitchG=new THREE.Group(); pitchG.position.set(0,0.07,0); yawG.add(pitchG);
  add(pitchG, new THREE.BoxGeometry(0.11*s,0.12*s,0.42*s), dark, 0,0.02,-0.02);                   // receiver
  const cover=new THREE.Group(); cover.position.set(0,0.085*s,-0.2*s); pitchG.add(cover); add(cover, new THREE.BoxGeometry(0.1*s,0.02,0.3*s), steel, 0,0,0.15*s);   // feed cover (opens on a reload)
  const barrel=new THREE.Group(); barrel.position.set(0,0.03,0.18*s); pitchG.add(barrel);
  add(barrel, new THREE.CylinderGeometry(0.022*s,0.026*s,0.95*s,10), steel, 0,0,0.47*s).rotation.x=Math.PI/2;
  if(heavy) for(let i=0;i<5;i++) add(barrel, new THREE.CylinderGeometry(0.034*s,0.034*s,0.035,10), dark, 0,0,0.06+i*0.07).rotation.x=Math.PI/2;   // M2-style barrel jacket rings
  add(barrel, new THREE.CylinderGeometry(0.034*s,0.026*s,0.09*s,10), dark, 0,0,0.98*s).rotation.x=Math.PI/2;   // flash hider
  const muzzle=new THREE.Object3D(); muzzle.position.set(0,0,1.05*s); barrel.add(muzzle);
  for(const sx of [-1,1]){ const g=add(pitchG, new THREE.CylinderGeometry(0.016,0.016,0.1,8), dark, sx*0.045,0.0,-0.27*s); g.rotation.x=0.5; }   // spade grips
  const box=add(pitchG, new THREE.BoxGeometry(0.1*s,0.13*s,0.2*s), olive, -0.12*s,-0.03,0.0);   // belt box on the left
  const belt=add(pitchG, new THREE.BoxGeometry(0.06,0.02,0.07), brass, -0.065*s,0.05,0.0);
  const eject=new THREE.Object3D(); eject.position.set(0.07*s,0.0,0.02); pitchG.add(eject);     // brass + links leave on the right
  const seat=new THREE.Object3D(); seat.position.set(0,0.0,-0.4); root.add(seat);               // where the gunner stands (in the hatch, behind the gun)
  return { root, yawG, pitchG, barrel, muzzle, cover, box, belt, eject, seat, heavy }; }
// the commander's side of the roof, behind the gun mantlet: measured from the turret's bulk (barrel + thin aerials ignored)
const _bb=new THREE.Box3(), _tb=new THREE.Box3(), _mx=new THREE.Matrix4(), _inv=new THREE.Matrix4(), _sz=new THREE.Vector3();
function roofSpot(p){ const T=p.mesh.userData.turret, gp=p.mesh.userData.gunPivot; p.mesh.updateMatrixWorld(true); _inv.copy(T.matrixWorld).invert(); _bb.makeEmpty();
  T.traverse(o=>{ if(!o.isMesh || !o.geometry) return; for(let a=o; a && a!==T; a=a.parent) if(a===gp) return; if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    _tb.copy(o.geometry.boundingBox).applyMatrix4(_mx.multiplyMatrices(_inv, o.matrixWorld)); _tb.getSize(_sz); if(_sz.x<0.3 || _sz.z<0.3) return; _bb.union(_tb); });
  if(_bb.isEmpty()) return { x:0.45, y:0.5, z:-0.3 }; return { x:_bb.max.x*0.4, y:_bb.max.y-0.02, z:_bb.min.z+(_bb.max.z-_bb.min.z)*0.3 }; }
// a new run / a different tank or gun: mount the picked MG on this tank's roof
export function mountRoofMG(p){ if(!p || !p.mesh || !p.mesh.userData.turret) return; if(MGR.mesh && MGR.mesh.root.parent) MGR.mesh.root.parent.remove(MGR.mesh.root);
  const id=mgPicked(), D=mgStats(id), M=buildMG(D), sp=roofSpot(p); M.root.position.set(sp.x, sp.y, sp.z); p.mesh.userData.turret.add(M.root);
  Object.assign(MGR, { mesh:M, id, stat:D, ammo:D.mag, reloadUntil:0, swapUntil:0, gunner:null, tgt:null, shotT:0, burst:0, pauseUntil:0, owner:p, yaw:p.facing||0, pitch:0 }); }

const _w=new THREE.Vector3(), _w2=new THREE.Vector3();
function pickTarget(px, pz, R){ let best=null, bq=R*R;
  for(const e of enemies){ if(!e.def || !e.def.inf || e.abandoned || e.hp<=0) continue; const dx=e.pos.x-px, dz=e.pos.z-pz, q=dx*dx+dz*dz; if(q<bq){ bq=q; best={ e, x:e.pos.x, y:1.0, z:e.pos.z }; } }
  if(best) return best;
  for(const t of towers){ if(t.falling) continue; for(const gd of t.guards){ if(!gd.alive || gd.wx==null) continue; const dx=gd.wx-px, dz=gd.wz-pz, q=dx*dx+dz*dz; if(q<bq){ bq=q; best={ t, gd, x:gd.wx, y:(gd.wy||6)+0.9, z:gd.wz }; } } }
  return best; }
// ---------------- every frame ----------------
export function updateRoofMG(dt, now){ const p=S.player, M=MGR.mesh; if(!p || !M || MGR.owner!==p) return;
  const usable = S.mode==='playing' && riders.length>0 && !mgBlocked(p) && !p.dead;
  M.root.visible = !mgBlocked(p); MGR.on = usable;
  if(!usable){ if(MGR.gunner){ const g=MGR.gunner.g; if(g&&g.userData.gun) g.userData.gun.visible=true; MGR.gunner=null; } hud(); return; }
  const D=MGR.stat, T=p.mesh.userData.turret, turretYaw=(p.mesh.rotation.y||0)+(T.rotation.y||0);
  // crew: the first rider mans the gun; a new man needs a moment to climb into the hatch
  if(MGR.gunner!==riders[0]){ if(MGR.gunner && MGR.gunner.g && MGR.gunner.g.userData.gun) MGR.gunner.g.userData.gun.visible=true;
    if(MGR.gunner) { MGR.swapUntil=now+1.3; floatText('KÍP SÚNG MÁY THAY NGƯỜI', '#ffcf5a', p.pos, 14); } else MGR.swapUntil=now+0.6;
    MGR.gunner=riders[0]; if(MGR.gunner.g.userData.gun) MGR.gunner.g.userData.gun.visible=false; }
  // target: re-pick 5× a second, keep the current one while it's still in reach
  if(now>=MGR.tgtAt){ MGR.tgtAt=now+0.2; MGR.tgt=pickTarget(p.pos.x, p.pos.z, D.range); }
  const tg=MGR.tgt; if(tg && tg.e && (tg.e.hp<=0 || !enemies.includes(tg.e))) MGR.tgt=null; else if(tg && tg.e){ tg.x=tg.e.pos.x; tg.z=tg.e.pos.z; }
  if(tg && tg.gd && !tg.gd.alive) MGR.tgt=null;
  M.muzzle.getWorldPosition(_w);
  if(MGR.reloadUntil && now>=MGR.reloadUntil){ MGR.ammo=MGR.stat.mag; MGR.reloadUntil=0; sfx('reloaded', p.pos, 0.6); }   // the fresh box is on: finish the reload BEFORE checking for an empty gun
  const reloading=now<MGR.reloadUntil, swapping=now<MGR.swapUntil;
  let wantYaw, wantPitch;
  if(MGR.tgt && !reloading){ wantYaw=Math.atan2(MGR.tgt.x-_w.x, MGR.tgt.z-_w.z); const d=Math.hypot(MGR.tgt.x-_w.x, MGR.tgt.z-_w.z)||1; wantPitch=Math.atan2(MGR.tgt.y-_w.y, d); }
  else { wantYaw=turretYaw+Math.sin(now*0.45)*0.7; wantPitch=reloading?0.55:0.06; }   // no target: the gunner scans the flank; reloading: muzzle up, cover open
  wantPitch=Math.max(-0.18, Math.min(1.05, wantPitch));
  const dy=wrapAngle(wantYaw-MGR.yaw), stepY=D.trav*dt*(swapping?0.3:1); MGR.yaw=wrapAngle(MGR.yaw + Math.max(-stepY, Math.min(stepY, dy)));
  const dp=wantPitch-MGR.pitch, stepP=D.elev*dt; MGR.pitch += Math.max(-stepP, Math.min(stepP, dp));
  MGR.kick=Math.max(0, MGR.kick-dt*14);
  M.yawG.rotation.y=wrapAngle(MGR.yaw-turretYaw); M.pitchG.rotation.x=-(MGR.pitch + MGR.kick*0.025*(Math.random()-0.3)); M.barrel.position.z=0.18*(M.heavy?1.18:1)-MGR.kick*0.025;
  // reload: the box comes off, a fresh one goes on, the cover slams shut
  if(reloading){ const ph=1-(MGR.reloadUntil-now)/MGR.reloadDur; M.cover.rotation.x=-1.2*Math.sin(Math.min(1,ph)*Math.PI); M.box.visible=ph>0.5; M.belt.visible=ph>0.7; }
  else if(MGR.ammo<=0){ MGR.reloadDur=D.reload; MGR.reloadUntil=now+D.reload; floatText('THAY HỘP ĐẠN', '#ffcf5a', p.pos, 13); sfx('reload', p.pos, 0.7); }
  else { M.cover.rotation.x=0; M.box.visible=true; M.belt.visible=true; }
  // fire: only on target, in bursts of 6–10 with short pauses (the barrel climbs, he re-lays)
  const onTarget = MGR.tgt && Math.abs(wrapAngle(wantYaw-MGR.yaw))<0.07 && Math.abs(wantPitch-MGR.pitch)<0.09;
  if(onTarget && !reloading && !swapping && MGR.ammo>0 && now>=MGR.pauseUntil){ if(MGR.burst<=0) MGR.burst=6+((Math.random()*5)|0);
    MGR.shotT += dt*D.rof; while(MGR.shotT>=1 && MGR.ammo>0 && MGR.burst>0){ MGR.shotT-=1; MGR.burst--; MGR.ammo--; fire(D, now); }
    if(MGR.burst<=0) MGR.pauseUntil=now+0.22+Math.random()*0.25; }
  else MGR.shotT=Math.min(MGR.shotT, 1);
  // the gunner: waist-up out of the hatch, turning with the gun, shaking with it
  const G=MGR.gunner; if(G && G.g){ M.seat.getWorldPosition(_w2); const sc=RIDER.scale*p.scale; G.g.position.set(_w2.x, _w2.y-0.68*sc, _w2.z); G.g.rotation.y=MGR.yaw; G.g.scale.setScalar(sc);
    animateSoldier(G.g, 0, dt, false); const up=G.g.userData.up; if(up){ up.rotation.x=-MGR.pitch*0.35 + MGR.kick*0.03; } }
  hud(); }
function fire(D, now){ const M=MGR.mesh, p=S.player; M.muzzle.getWorldPosition(_w); const a=MGR.yaw+(Math.random()-0.5)*D.spread*2, fx=Math.sin(a), fz=Math.cos(a), tr=(MGR.shots++%4)===0;
  MGR.kick=1;
  if(MGR.tgt && MGR.tgt.gd){ const G=MGR.tgt, d=Math.hypot(G.x-_w.x, G.z-_w.z)||1;   // up at a man on a tower: a tracer, and a chance to knock him off
    spawnPart(_w.x,_w.y,_w.z, (G.x-_w.x)/d*90, (G.y-_w.y)/d*90, (G.z-_w.z)/d*90, { tex:'flash', color:tr?0xffb040:0xffe6a0, size:tr?0.34:0.2, life:d/90, grav:0, drag:0 });
    if(Math.random() < 0.04+D.dmg*0.007) shootGuard(G.t, G.gd, p.pos.x, p.pos.z); }
  else spawnBullet(_w.x, _w.z, a, { owner:'p', inf:true, dmg:D.dmg*(p.dmgMul||1)*0.5+D.dmg*0.5, speed:105, color:tr?0xffa030:0xffe6a0, r:tr?0.24:0.16, life:0.5, maxDist:D.range+3, y:_w.y });
  // muzzle: flash, a few sparks, a wisp of smoke · receiver: brass (and a link) thrown out to the right
  spawnPart(_w.x+fx*0.1,_w.y,_w.z+fz*0.1, fx*3,0.2,fz*3, { tex:'flash', color:0xfff0b0, size:M.heavy?0.75:0.55, life:0.045, grav:0, drag:9 });
  for(let k=0;k<2;k++) spawnPart(_w.x,_w.y,_w.z, fx*9+(Math.random()-0.5)*5, 1+Math.random()*2.5, fz*9+(Math.random()-0.5)*5, { color:0xffc860, size:0.07, life:0.18, grav:6, drag:2 });
  if(MGR.shots%2===0) spawnPart(_w.x,_w.y+0.05,_w.z, fx*1.2,0.8,fz*1.2, { color:0xb8b0a4, size:0.35, life:0.8, smoke:true, grav:-0.6, drag:1.4, grow:1.4, op:0.28 });
  M.eject.getWorldPosition(_w2); const rx=Math.cos(MGR.yaw), rz=-Math.sin(MGR.yaw);
  spawnPart(_w2.x,_w2.y,_w2.z, rx*(2.2+Math.random())+(Math.random()-0.5), 2+Math.random()*1.5, rz*(2.2+Math.random())+(Math.random()-0.5), { color:0xd8a840, size:M.heavy?0.11:0.08, life:0.9, grav:-14, drag:0.4 });
  if(MGR.shots%3===0) spawnPart(_w2.x,_w2.y,_w2.z, rx*1.6, 1.4, rz*1.6, { color:0x3a3a36, size:0.07, life:0.8, grav:-14, drag:0.5 });   // a belt link
  if(MGR.shots%2===0 || M.heavy) sfx('shoot_smg', _w, M.heavy?0.85:0.5); }
// a small ammo readout above the crew button while the gun is manned
function hud(){ let h=MGR.hud; if(!h){ h=MGR.hud=document.createElement('div'); h.id='mgHud'; document.body.appendChild(h); }
  const show=MGR.on && S.mode==='playing'; h.classList.toggle('on', show); if(!show) return; const now=performance.now()/1000;
  const t = now<MGR.reloadUntil ? 'THAY HỘP…' : now<MGR.swapUntil ? 'THAY NGƯỜI…' : MGR.ammo+'/'+MGR.stat.mag;
  const html='<b>'+MGR.stat.vi.split(' ')[0]+'</b> '+t; if(h._t!==html){ h._t=html; h.innerHTML=html; } }

// ---------------- Z167 shop: buy a roof MG, pick it, upgrade it (through the server once linked) ----------------
export async function buyRoofMG(id){ const D=ROOF_MG.find(m=>m.id===id); if(!D || !D.price || mgOwned().includes(id) || !canAfford(D.price)){ sfx('alarm'); return false; }
  const ok=await econBuy('mg', id, null, D.price, ()=>{ if(!mgOwned().includes(id)) PROFILE.ownedMgs.push(id); }); if(ok){ PROFILE.mgPick=id; saveProfile(); } sfx(ok?'levelup':'alarm'); return ok; }
export function pickRoofMG(id){ if(!mgOwned().includes(id)) return; PROFILE.mgPick=id; saveProfile(); sfx('click'); }
export function mgUpCost(id, key){ const t=ROOF_MG_UP.find(x=>x.key===key), L=mgLevels(id)[key]|0; return t && L<t.cost.length ? t.cost[L] : null; }
export async function upRoofMG(id, key){ const c=mgUpCost(id, key); if(!c || !mgOwned().includes(id) || !canAfford(c)){ sfx('alarm'); return false; }
  const ok=await econBuy('mgup', id, key, c, ()=>{ mgLevels(id)[key]++; }); sfx(ok?'levelup':'alarm'); return ok; }
