// world/tunnels.js — Z225 ĐỊA ĐẠO: the enemy has dug a tunnel network under the battlefield (from stage 2, every custom battle, and the cavern is riddled with it).
//   · its ways in: SPIDER HOLES (a camouflaged wooden lid flush with the ground — you spot one close up, or when men climb out of it),
//     sandbagged BUNKER STAIRS going down under a concrete slab, and in the cavern great MINE MOUTHS framed in timber in the walls
//   · a hurt or pinned-down enemy rifleman near a way in drops into it and comes up somewhere else a few seconds later, patched up
//   · every half minute or so a whole squad climbs out of one — behind you as often as not
//   · shell a way in to cave it in (a spider hole goes with one good hit, bunkers and mouths take a pounding);
//     seal them all and the men still down there are buried
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TUNNEL } from '../../config.js';
import { ARENA, BIOME, CAVE, MOBILE, S, UNDER, _canvasTex, addScore, blocks, buildCavern, buildUnderbase, burst, damageEnemy, decalCrater, detailize, enemies, enemyPool, fieldEdgePoint, floatText, freeEnemyBar, heightAt, homeClear, inField, inZone, propTex, radio, rockSet, scene, sfx, showBanner, spawnDebris, spawnEnemy, spawnSquad, wetAt } from '../hub.js';

export const TUN = { list:[], under:[], next:0, chk:0, told:false, g:null };
const R=(a,b)=>a+Math.random()*(b-a), RN=a=>Math.round(R(a[0], a[1]+0.99)-0.49), TAU=Math.PI*2;
const _V=new THREE.Vector3();
let _M=null;
function mats(){ if(_M) return _M; const ground=new THREE.Color(BIOME.ground);
  _M={ conc:detailize(new THREE.MeshStandardMaterial({ map:propTex('concrete'), color:0xb0aca2, roughness:0.92 }), { scale:0.6, bump:0.025, alb:0.3, foot:0.8, streak:0.3 }), bag:new THREE.MeshStandardMaterial({ color:0x9c8e6c, roughness:0.97 }),   // Z236 cast concrete with stains (was a flat untextured grey that read as placeholder boxes)
    wood:new THREE.MeshStandardMaterial({ color:0x5a3e26, roughness:0.9 }), black:new THREE.MeshBasicMaterial({ color:0x000000 }),
    lid:new THREE.MeshStandardMaterial({ color:ground, roughness:1 }), rim:new THREE.MeshStandardMaterial({ color:ground.clone().multiplyScalar(0.7), roughness:1 }),
    leaf:new THREE.MeshStandardMaterial({ color:0x4a5a2a, roughness:1 }), lamp:new THREE.MeshStandardMaterial({ color:0x300000, emissive:0xff2a14, emissiveIntensity:3 }),
    steel:new THREE.MeshStandardMaterial({ color:0x4a4c48, roughness:0.55, metalness:0.7, map:propTex('drum') }), yel:new THREE.MeshStandardMaterial({ color:0xc8a030, roughness:0.7 }), black2:new THREE.MeshStandardMaterial({ color:0x1e1e1c, roughness:0.7 }),
    sign:new THREE.MeshStandardMaterial({ map:_canvasTex(128,80,(x,W,H)=>{ x.fillStyle='#c8b080'; x.fillRect(0,0,W,H); x.fillStyle='#8a1a14'; x.fillRect(0,0,W,18); x.fillStyle='#f0e6d0'; x.font='bold 13px monospace'; x.fillText('CẤM VÀO',24,14); x.fillStyle='#2a2420'; x.font='bold 22px monospace'; x.fillText('HẦM B-3',14,54); }), roughness:0.85 }),
    mark:new THREE.MeshBasicMaterial({ color:0xff7a3a, transparent:true, opacity:0.7, depthWrite:false, side:THREE.DoubleSide, fog:false }) };
  return _M; }
const BX=(w,h,d,x,y,z,m,par)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m); o.position.set(x,y,z); o.castShadow=!MOBILE; o.receiveShadow=true; par.add(o); return o; };

// ---- the ways in ----
function hatch(E){ const M=mats(), g=E.g;
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.3,0.16,14), M.rim); rim.position.y=0.04; g.add(rim);
  const pit=new THREE.Mesh(new THREE.CircleGeometry(0.78,14), M.black); pit.rotation.x=-Math.PI/2; pit.position.y=0.13; g.add(pit);
  const hinge=new THREE.Group(); hinge.position.set(-0.72,0.16,0); g.add(hinge); BX(1.44,0.09,1.44,0.72,0,0,M.lid,hinge);
  for(let k=0;k<3;k++){ const t=new THREE.Mesh(new THREE.ConeGeometry(0.16,0.42,5), M.leaf); t.position.set(0.72+R(-0.45,0.45),0.2,R(-0.45,0.45)); hinge.add(t); }   // a few tufts tied on as camouflage
  E.lid=hinge; E.rad=1.6; E.hp=E.maxHp=TUNNEL.hp.hatch; E.seen=false; }
function bunker(E){ const M=mats(), g=E.g;
  BX(4.4,0.5,3.4,0,1.25,-0.7,M.conc,g); BX(0.45,1.25,4.8,-2.0,0.5,0,M.conc,g); BX(0.45,1.25,4.8,2.0,0.5,0,M.conc,g); BX(4.4,1.25,0.45,0,0.5,-2.3,M.conc,g);
  { const BG=new RoundedBoxGeometry(0.9,0.3,0.5,2,0.12); for(let k=0;k<10;k++){ const o=new THREE.Mesh(BG, M.bag); o.position.set(-1.8+(k%5)*0.9+(k>4?0.45:0),1.66+(k>4?0.28:0),-1.55+(k>4?0.35:0)+R(-0.06,0.06)); o.rotation.set(R(-0.05,0.05),R(-0.12,0.12),R(-0.05,0.05)); o.castShadow=!MOBILE; g.add(o); } }   // Z236 a course of sandbags on the roof slab
  for(const sx of [-1,1]){ BX(0.12,1.3,0.14,sx*1.72,0.65,1.12,M.steel,g); for(let k=0;k<5;k++){ const st=BX(0.13,0.2,0.15,sx*1.72,0.18+k*0.26,1.13,k%2?M.black2:M.yel,g); st.rotation.z=sx*0.0; } }   // steel door frame with hazard banding
  BX(3.6,0.14,0.16,0,1.3,1.12,M.steel,g);   // lintel
  { const pl=new THREE.Mesh(new THREE.PlaneGeometry(0.7,0.42), M.sign); pl.position.set(1.0,1.02,1.21); g.add(pl); }   // stencilled sign
  const hole=new THREE.Mesh(new THREE.PlaneGeometry(3.5,4.1), M.black); hole.rotation.x=-Math.PI/2; hole.position.set(0,0.07,0); g.add(hole);
  for(let k=0;k<3;k++){ const s=new THREE.Mesh(new THREE.PlaneGeometry(3.5,0.18), new THREE.MeshBasicMaterial({ color:new THREE.Color(0x6a665e).multiplyScalar(0.8-k*0.25) })); s.rotation.x=-Math.PI/2; s.position.set(0,0.09,1.8-k*0.75); g.add(s); }   // the top steps, sinking into the dark
  BX(0.22,1.6,0.22,-1.55,0.8,1.0,M.wood,g); BX(0.22,1.6,0.22,1.55,0.8,1.0,M.wood,g); BX(3.4,0.24,0.24,0,1.55,1.0,M.wood,g);
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,6), M.lamp); lamp.position.set(0,0.95,-1.9); g.add(lamp);
  E.rad=2.6; E.hp=E.maxHp=TUNNEL.hp.bunker; E.seen=true;
  E.blk={ mesh:g, x:E.x, z:E.z, r:2.5, hp:1e9, maxHp:1e9, steel:false, hard:false, loot:false, kind:'tunnel', tun:E }; blocks.push(E.blk); }
function mouth(E){ const M=mats(), g=E.g;
  BX(0.6,6.4,0.6,-4.1,3.2,0,M.wood,g); BX(0.6,6.4,0.6,4.1,3.2,0,M.wood,g); BX(9.6,0.75,0.75,0,6.6,0,M.wood,g);
  for(const s of [-1,1]){ const b=BX(0.3,2.6,0.3,s*3.3,5.4,0.05,M.wood,g); b.rotation.z=s*0.75; }
  const rock=rockSet(BIOME.name); for(let k=0;k<5;k++){ const m=new THREE.Mesh(rock.big[k%rock.big.length], rock.mat); m.scale.set(R(5,8),R(4,7),R(5,8)); m.position.set(R(-7,7), R(8,13), R(-9,-3)); m.rotation.set(R(0,3),R(0,3),R(0,3)); m.userData.keep=true; g.add(m); }   // the rock lid over the mouth
  const v=new THREE.Mesh(new THREE.PlaneGeometry(9,7.4), M.black); v.position.set(0,3.6,-9); g.add(v);
  for(const s of [-1,1]){ const w=new THREE.Mesh(new THREE.PlaneGeometry(9.5,8), M.black); w.position.set(s*4.6,3.8,-4.6); w.rotation.y=s*Math.PI/2; g.add(w); }
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.2,8,6), M.lamp); lamp.position.set(0,6.1,0.45); g.add(lamp);
  E.voids=[v]; E.rad=5.2; E.hp=E.maxHp=TUNNEL.hp.mouth; E.seen=true; }
function markRing(E){ const m=new THREE.Mesh(new THREE.RingGeometry(E.rad*0.95, E.rad*1.15, 28), mats().mark.clone()); m.rotation.x=-Math.PI/2; m.position.set(E.x, heightAt(E.x,E.z)+0.25, E.z); m.visible=false; m.renderOrder=3; TUN.g.add(m); E.mark=m; }

export function clearTunnels(){ for(const e of TUN.under){ e._under=null; if(e.mesh){ e.mesh.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(e.mesh); } if(e.bar){ freeEnemyBar(e.bar); e.bar=null; } } TUN.under.length=0;
  for(let i=blocks.length-1;i>=0;i--) if(blocks[i].kind==='tunnel') blocks.splice(i,1);
  if(TUN.g){ scene.remove(TUN.g); TUN.g.traverse(o=>{ if(o.geometry && !o.userData.keep) o.geometry.dispose(); }); TUN.g=null; } TUN.list.length=0; TUN.next=0; TUN.told=false; _M=null; }
const clearOf=(x,z,r)=>!blocks.some(b=>(b.x-x)**2+(b.z-z)**2<(b.r+r)**2);
export function buildTunnels(){ clearTunnels(); if(CAVE) CAVE.extra.length=0; const run=S.run||{}, cave=!!(CAVE && CAVE.on);
  if(!cave && run.mode!=='custom' && S.stage<TUNNEL.from) return;
  const g=new THREE.Group(); TUN.g=g; scene.add(g);
  const add=(kind,x,z,a)=>{ const E={ kind, x, z, a, open:0, sealed:false, g:new THREE.Group() }; E.g.position.set(x, heightAt(x,z), z); E.g.rotation.y=a; g.add(E.g);
    (kind==='hatch'?hatch:kind==='bunker'?bunker:mouth)(E); markRing(E); TUN.list.push(E); return E; };
  if(cave) for(const m of CAVE.mouths){ const [x,z]=fieldEdgePoint(m.a, 0.2), [ix,iz]=fieldEdgePoint(m.a, 4.5); if(!clearOf(ix,iz,6) || inZone(ix,iz,3)) continue;   // a fort built across the mouth: it stays a dark recess
    const E=add('mouth', ix, iz, Math.atan2(-Math.cos(m.a), -Math.sin(m.a)));
    E.g.position.set(x, heightAt(x,z), z); const tx=-Math.sin(m.a), tz=Math.cos(m.a);
    for(const s of [-1,1]) CAVE.extra.push({ x:x+tx*4.9*s-Math.cos(m.a)*0.6, y:heightAt(x,z)+3.6, z:z+tz*4.9*s-Math.sin(m.a)*0.6, k:1.35, ph:Math.random()*9, big:true }); }
  const n=cave ? TUNNEL.caveN : RN(TUNNEL.n), kinds=[]; for(let i=0;i<n;i++) kinds.push(i===0?'bunker':'hatch');
  for(const kind of kinds){ const need=kind==='bunker'?5:2.5;
    for(let t=0;t<200;t++){ const x=R(-ARENA*0.82, ARENA*0.82), z=R(-ARENA*0.86, ARENA*0.3);
      if(!inField(x,z,9) || !homeClear(x,z,need,true) || Math.hypot(x, z-ARENA*0.55)<46 || inZone(x,z,4) || wetAt(x,z,3) || !clearOf(x,z,need) || TUN.list.some(E=>Math.hypot(E.x-x,E.z-z)<38)) continue;
      const E=add(kind, x, z, Math.atan2(x, z)+Math.PI+R(-0.6,0.6));
      if(cave && kind==='bunker'){ const fx=Math.sin(E.a), fz=Math.cos(E.a), sx=Math.cos(E.a), sz=-Math.sin(E.a); CAVE.extra.push({ x:x+fx*1.0+sx*1.9, y:heightAt(x,z)+1.9, z:z+fz*1.0+sz*1.9, k:0.9, ph:Math.random()*9 }); }   // a torch at the bunker door
      break; } }
  TUN.next=0; }

// the whole underground for a new stage: the tunnels first (the cavern hangs torches on the mine mouths), then the cavern
export function buildUnderground(){ buildTunnels(); buildCavern(); buildUnderbase(); }

// ---- queries ----
const openList=()=>TUN.list.filter(E=>!E.sealed);
export function tunnelOpen(){ return openList().length; }
function nearestOpen(x, z, r){ let best=null, bd=r*r; for(const E of TUN.list){ if(E.sealed) continue; const d=(E.x-x)**2+(E.z-z)**2; if(d<bd){ bd=d; best=E; } } return best; }
// a way in for a fresh squad: 24–70 m from the tank, behind it if possible (pref = the bearing to favour, radians)
function pickExit(pref, not){ const p=S.player; if(!p) return null; const A=TUNNEL.ambush; let best=null, bs=-1;
  for(const E of TUN.list){ if(E.sealed || E===not) continue; const d=Math.hypot(E.x-p.pos.x, E.z-p.pos.z); if(d<A.r[0] || d>A.r[1]) continue;
    let s=1+Math.random(); if(pref!=null){ const b=Math.atan2(E.x-p.pos.x, E.z-p.pos.z); let da=Math.abs(b-pref); da=Math.min(da, TAU-da); s+=2.5*(1-da/Math.PI); }
    if(s>bs){ bs=s; best=E; } }
  return best; }
// where reinforcements walk out of a mine mouth (the cavern); null if none is open
export function mouthSpawnPoint(){ const M=TUN.list.filter(E=>E.kind==='mouth' && !E.sealed); if(!M.length) return null; const E=M[(Math.random()*M.length)|0]; puff(E); return { x:E.x+R(-2,2), z:E.z+R(-2,2) }; }

// ---- life ----
function puff(E, big){ E.open=1.6; burst({ x:E.x, z:E.z }, BIOME.ground, big?8:4, big?4:2.4, { y:heightAt(E.x,E.z)+0.4, life:1.0, size:big?1.8:1.1, smoke:true, grav:-0.4, drag:2, up:1.2, op:0.42 }); }
function reveal(E){ if(E.seen && E.mark && E.mark.visible) return; E.seen=true; if(E.mark) E.mark.visible=true;
  if(E.kind==='hatch') floatText('LỐI VÀO ĐỊA ĐẠO', '#ffb070', { x:E.x, y:heightAt(E.x,E.z)+2.5, z:E.z }, 15);
  if(!TUN.told){ TUN.told=true; showBanner('PHÁT HIỆN ĐỊA ĐẠO ĐỊCH', '#ffb070'); radio('SCH: Địch có hầm ngầm dưới chân ta — bắn sập các lối lên, đừng để chúng trồi sau lưng!'); } }
function goUnder(e, E, now){ const i=enemies.indexOf(e); if(i<0) return; enemies.splice(i,1); e._under={ until:now+R(TUNNEL.under[0], TUNNEL.under[1]), from:E };
  e.mesh.visible=false; if(e.bar) e.bar.g.visible=false; TUN.under.push(e); puff(E);
  const p=S.player; if(p && Math.hypot(p.pos.x-E.x, p.pos.z-E.z)<70){ reveal(E); floatText('XUỐNG ĐỊA ĐẠO', '#c8b48a', { x:E.x, y:heightAt(E.x,E.z)+2, z:E.z }, 13); } }
function comeUp(e, now){ const p=S.player, E=pickExit(p ? Math.atan2(-Math.sin(p.facing||0), -Math.cos(p.facing||0)) : null, e._under.from) || openList().find(q=>q!==e._under.from) || e._under.from;
  e._under=null; const a=Math.random()*TAU; e.pos.x=E.x+Math.cos(a)*(E.rad+0.6); e.pos.z=E.z+Math.sin(a)*(E.rad+0.6);
  e.hp=Math.min(e.maxHp, e.hp+e.maxHp*TUNNEL.heal); e.supp=0; e.mesh.visible=true; enemies.push(e); puff(E);
  if(p && Math.hypot(p.pos.x-E.x, p.pos.z-E.z)<70) reveal(E); }
export function tunnelSquad(pref){ if(!TUN.list.length || enemies.length>TUNNEL.ambush.cap || UNDER.on) return false;
  if(Math.random()<UNDER.cut.inf || (UNDER.targets.length && !UNDER.targets.some(o=>o.role==='inf' && o.alive))) return false;   // Z226 their barracks below are wrecked
  const E=pickExit(pref); if(!E) return false;
  const back=Math.atan2(-E.x, -E.z); spawnSquad({ x:E.x+Math.sin(back)*(E.rad+1), z:E.z+Math.cos(back)*(E.rad+1) }); puff(E, true);
  if(E.kind==='mouth' && S.stage>=2 && Math.random()<0.4) setTimeout(()=>{ if(S.mode==='playing' && !E.sealed) spawnEnemy(S.stage>=4?'heavy':'grunt', E.x, E.z); }, 1400);
  reveal(E); return true; }
export function updateTunnels(dt, now){ if(!TUN.g) return;
  for(const E of TUN.list){ if(E.open>0){ E.open=Math.max(0, E.open-dt); if(E.lid) E.lid.rotation.z=Math.min(1, E.open)*1.85; }
    if(E.mark && E.mark.visible){ E.mark.material.opacity=0.35+0.3*Math.sin(now*4+E.x); } }
  if(S.mode!=='playing' || UNDER.on) return; const p=S.player;
  for(let i=TUN.under.length-1;i>=0;i--){ const e=TUN.under[i]; if(e._under && now>e._under.until && openList().length){ TUN.under.splice(i,1); comeUp(e, now); } }
  if(now<TUN.chk) return; TUN.chk=now+0.4;
  if(p) for(const E of TUN.list) if(!E.sealed && !(E.mark && E.mark.visible) && Math.hypot(p.pos.x-E.x, p.pos.z-E.z)<TUNNEL.seeR) reveal(E);
  if(openList().length>=2) for(const e of enemies.slice()){ if(!e.def.inf || e.hp<=0 || e._under || (e.dazeUntil||0)>now) continue;
    if(!(e.hp<e.maxHp*TUNNEL.hurtK || (e.supp||0)>TUNNEL.suppK)) continue; const E=nearestOpen(e.pos.x, e.pos.z, TUNNEL.grabR); if(E && Math.random()<0.35) goUnder(e, E, now); }
  const A=TUNNEL.ambush; if(!TUN.next){ TUN.next=now+R(A.first[0], A.first[1]); return; }
  if(now>TUN.next){ TUN.next=now+R(A.every[0], A.every[1]); if(p && tunnelSquad(Math.atan2(-Math.sin(p.facing||0), -Math.cos(p.facing||0)))) showBanner('⚠ ĐỊCH TRỒI LÊN TỪ ĐỊA ĐẠO!', '#ffb070'); } }

// ---- caving a way in ----
export function hitTunnel(E, dmg){ if(!E || E.sealed) return; E.hp-=dmg; reveal(E); burst({ x:E.x, z:E.z }, BIOME.ground, 3, 2.5, { y:heightAt(E.x,E.z)+0.6, life:0.8, size:1.2, smoke:true, grav:-0.4, drag:2, up:1.2, op:0.4 });
  if(E.hp<=0) seal(E); }
export function tunnelBlast(x, z, r, dmg){ if(!TUN.list.length) return; for(const E of TUN.list){ if(E.sealed) continue; const d=Math.hypot(E.x-x, E.z-z), R0=r+E.rad; if(d<R0) hitTunnel(E, dmg*(1-0.5*d/R0)); } }
function seal(E){ E.sealed=true; const gy=heightAt(E.x,E.z);
  burst({ x:E.x, z:E.z }, BIOME.ground, 12, E.rad*2.4, { y:gy+0.5, life:2.0, size:2.6, smoke:true, grav:-0.25, drag:1.3, up:2, op:0.5 }); for(let k=0;k<3;k++) spawnDebris({ x:E.x+R(-1,1)*E.rad, z:E.z+R(-1,1)*E.rad }, 0.9, 0x6e665a);
  decalCrater(E.x, E.z, E.rad*1.1, 0.9); sfx('bigexplode', _V.set(E.x,0,E.z)); S.shake=Math.max(S.shake, 0.6);
  if(E.mark) E.mark.visible=false; if(E.lid) E.lid.visible=false; if(E.voids) for(const v of E.voids) v.visible=false;
  E.g.traverse(o=>{ if(o.material===mats().black) o.visible=false; });
  const rs=rockSet(BIOME.name), n=E.kind==='mouth'?7:E.kind==='bunker'?4:2;
  for(let k=0;k<n;k++){ const m=new THREE.Mesh(rs.big[k%rs.big.length], rs.mat), s=E.kind==='mouth'?R(2.4,3.6):R(0.7,1.4); m.scale.set(s, s*0.7, s); m.position.set(E.x+R(-0.6,0.6)*E.rad, gy+s*0.25, E.z+R(-0.6,0.6)*E.rad); m.rotation.y=R(0,TAU); m.castShadow=true; m.userData.keep=true; TUN.g.add(m); }
  if(E.blk){ const i=blocks.indexOf(E.blk); if(i>=0) blocks.splice(i,1); E.blk=null; }
  addScore(TUNNEL.score.seal, { x:E.x, y:gy+2, z:E.z }); floatText('SẬP ĐỊA ĐẠO', '#ffcf5a', { x:E.x, y:gy+3, z:E.z }, 17);
  if(!openList().length){ showBanner('ĐÃ PHÁ SẬP TOÀN BỘ ĐỊA ĐẠO!', '#9be04a'); radio('SCH: Mọi lối lên đã sập — bọn dưới hầm bị chôn sống. Làm tốt lắm!'); addScore(TUNNEL.score.all, { x:E.x, y:gy+4, z:E.z });
    for(const e of TUN.under.splice(0)){ e._under=null; e.pos.x=E.x+R(-1,1)*E.rad; e.pos.z=E.z+R(-1,1)*E.rad; e.mesh.visible=true; enemies.push(e); damageEnemy(e, e.hp+999); } } }
