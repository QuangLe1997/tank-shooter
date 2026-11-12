// world/env-events.js — Z140 SURPRISES OF THE LAND: every minute or two the battlefield itself does something — the village river floods,
//   a rockslide thunders down the hills, a shelled city block collapses, a sandstorm / blizzard / downpour sweeps in elsewhere. Announced on the radio.
import * as THREE from 'three';
import { BIOME, LAND, RIVER, S, aoeDamage, applyWeather, blocks, burst, damageEnemy, damagePlayer, enemies, floatText, heightAt, radio, rockSet, scene, sfx, showBanner, spawnDebris, spawnPart } from '../hub.js';

export const ENVEV = { next:0, active:null, rocks:[], fall:null };
export function resetEnvEvents(now){ ENVEV.next=(now||performance.now()/1000)+50+Math.random()*25; RIVER.y=-0.85; if(RIVER.mesh) RIVER.mesh.position.y=RIVER.y; ENVEV.active=null; /* a new stage already chose its own weather — never restore the old one */ for(const r of ENVEV.rocks) scene.remove(r.m); ENVEV.rocks.length=0; ENVEV.fall=null; }
function endActive(){ const A=ENVEV.active; if(!A) return; if(A.kind==='weather') applyWeather(A.prev||'clear'); if(A.kind==='flood'){ RIVER.y=-0.85; if(RIVER.mesh) RIVER.mesh.position.y=RIVER.y; } ENVEV.active=null; }
function announce(t, c, r){ showBanner(t, c); if(r) radio(r); sfx('alarm'); }

// ---- VILLAGE: flash flood (the water climbs the banks for a while: wading spreads, then it drains) ----
function flood(now){ if(!RIVER.on) return false; ENVEV.active={ kind:'flood', t0:now, dur:22 }; announce('LŨ QUÉT! NƯỚC SÔNG DÂNG', '#7fd0ff', 'SCH: Lũ đầu nguồn đổ về — tránh xa bờ sông, qua cầu mà đi!'); return true; }
// ---- HILLS: rockslide (boulders break loose from a crest near you and roll downhill, crushing anything in the way) ----
function rockslide(now){ const p=S.player; if(!p) return false; let best=null, bh=1.2;
  for(let k=0;k<40;k++){ const a=Math.random()*6.28, r=22+Math.random()*30, x=p.pos.x+Math.cos(a)*r, z=p.pos.z+Math.sin(a)*r, h=heightAt(x,z); if(h>bh){ bh=h; best=[x,z]; } }
  if(!best) return false; const rs=rockSet(BIOME.name);
  for(let i=0;i<6;i++){ const x=best[0]+(Math.random()-0.5)*8, z=best[1]+(Math.random()-0.5)*8, s=1.0+Math.random()*0.8, m=new THREE.Mesh(rs.big[i%rs.big.length], rs.mat); m.scale.setScalar(s); m.castShadow=true; scene.add(m);
    ENVEV.rocks.push({ m, x, z, s, vx:0, vz:0, t:0, hit:new Set(), delay:i*0.35 }); }
  announce('LỞ ĐẤT ĐÁ!', '#ffb35a', 'SCH: Đá lăn từ sườn đồi — tránh đường lăn!'); return true; }
function updateRocks(dt, now){ const p=S.player;
  for(let i=ENVEV.rocks.length-1;i>=0;i--){ const r=ENVEV.rocks[i]; if(r.delay>0){ r.delay-=dt; r.m.position.set(r.x, heightAt(r.x,r.z)+r.s*0.6, r.z); continue; } r.t+=dt;
    const e=1.2, gx=(heightAt(r.x+e,r.z)-heightAt(r.x-e,r.z))/(2*e), gz=(heightAt(r.x,r.z+e)-heightAt(r.x,r.z-e))/(2*e);
    r.vx+=(-gx*26 - r.vx*0.25)*dt; r.vz+=(-gz*26 - r.vz*0.25)*dt; if(p && r.t<0.6){ const dx=p.pos.x-r.x, dz=p.pos.z-r.z, L=Math.hypot(dx,dz)||1; r.vx+=dx/L*6*dt; r.vz+=dz/L*6*dt; }   // a nudge toward the fight
    const sp=Math.hypot(r.vx,r.vz); r.x+=r.vx*dt; r.z+=r.vz*dt; r.m.position.set(r.x, heightAt(r.x,r.z)+r.s*0.6, r.z); r.m.rotation.x+=r.vz*dt/r.s; r.m.rotation.z-=r.vx*dt/r.s;
    if(Math.random()<dt*10) spawnPart(r.x, heightAt(r.x,r.z)+0.3, r.z, (Math.random()-0.5)*2, 1, (Math.random()-0.5)*2, { color:BIOME.ground, size:1.4+Math.random(), life:0.8, smoke:true, grav:-0.3, drag:2, op:0.4 });
    if(sp>3){ for(const en of enemies){ if(r.hit.has(en) || en.def.air) continue; if(Math.hypot(en.pos.x-r.x, en.pos.z-r.z)<r.s*1.4+(en.r||1)){ r.hit.add(en); damageEnemy(en, 45*r.s); } }
      if(p && !r.hit.has(p) && Math.hypot(p.pos.x-r.x, p.pos.z-r.z)<r.s*1.4+1.6){ r.hit.add(p); damagePlayer(18*r.s, now); } }
    if(r.t>7 || (r.t>2 && sp<0.6)){ r.m.scale.multiplyScalar(Math.max(0.0, 1-dt*2)); if(r.m.scale.x<0.1){ scene.remove(r.m); ENVEV.rocks.splice(i,1); } } } }
// ---- CITY: a shelled block collapses (dust, debris, it crushes what stands at its foot — and opens a new street) ----
function collapse(now){ const p=S.player; if(!p) return false; const cand=LAND.meshes.filter(m=>m.userData && m.userData.land && m.parent).map(m=>({ m, d:Math.hypot(m.position.x-p.pos.x, m.position.z-p.pos.z) })).filter(o=>o.d>14 && o.d<70).sort((a,b)=>a.d-b.d);
  if(!cand.length) return false; const m=cand[0].m; ENVEV.fall={ m, t:0, y0:m.position.y, h:m.userData.h||10, done:false, tilt:(Math.random()-0.5)*0.3 };
  announce('TOÀ NHÀ SẬP!', '#ffcf5a', 'SCH: Một khối nhà trúng pháo đang đổ — tránh xa!'); return true; }
function updateFall(dt, now){ const F=ENVEV.fall; if(!F) return; F.t+=dt; const m=F.m, x=m.position.x, z=m.position.z;
  if(F.t<2.4){ const k=F.t/2.4; m.position.y=F.y0-F.h*k*k; m.rotation.z=F.tilt*k; m.rotation.x=F.tilt*0.6*k;
    if(Math.random()<dt*30) spawnPart(x+(Math.random()-0.5)*14, heightAt(x,z)+Math.random()*4, z+(Math.random()-0.5)*14, (Math.random()-0.5)*5, 2+Math.random()*3, (Math.random()-0.5)*5, { color:0xa8a49c, size:2.2+Math.random()*1.6, life:1.6, smoke:true, grav:-0.2, drag:1.3, grow:1.6, op:0.55 });
    S.shake=Math.max(S.shake, 0.9); return; }
  if(!F.done){ F.done=true; m.visible=false; for(let i=blocks.length-1;i>=0;i--) if(blocks[i].land===m) blocks.splice(i,1);
    for(let k=0;k<5;k++) spawnDebris({ x:x+(Math.random()-0.5)*10, z:z+(Math.random()-0.5)*10 }, 1.4, 0x8a8680);
    burst({ x, z }, 0xb0aca4, 10, 9, { y:1.5, life:2.2, size:3.2, smoke:true, grav:-0.2, drag:1.2, up:2, op:0.5 }); aoeDamage(x, z, 12, 60, false, now, 'HE', false);
    const p=S.player; if(p && Math.hypot(p.pos.x-x,p.pos.z-z)<12) damagePlayer(20, now); sfx('bigexplode'); floatText('MỞ ĐƯỜNG MỚI', '#9be04a', { x, y:4, z }, 16); }
  if(F.t>6) ENVEV.fall=null; }
// ---- elsewhere: the weather turns for half a minute ----
const SURGE={ DESERT:['sand','BÃO CÁT ẬP TỚI!','SCH: Bão cát — tầm nhìn giảm, bám sát đồng đội!'], TUNDRA:['snow','BÃO TUYẾT!','SCH: Bão tuyết kéo tới — giữ đội hình!'], MEADOW:['rain','GIÔNG BÃO!','SCH: Mưa giông — sét có thể đánh trúng!'],
  RUINS:['fog','SƯƠNG KHÓI DÀY ĐẶC!','SCH: Khói bụi phủ kín phố — địch có thể áp sát!'], FOUNDRY:['fog','KHÓI LÒ PHỦ KÍN!','SCH: Lò cao xả khói — cẩn thận phục kích!'], CITADEL:['sand','BÃO CÁT ẬP TỚI!','SCH: Bão cát quanh thành luỹ!'],
  CITY:['rain','MƯA GIÔNG TRÊN PHỐ!','SCH: Mưa lớn — đường phố trơn trượt!'], HILLS:['fog','SƯƠNG MÙ TRÊN ĐỒI!','SCH: Sương mù phủ đồi — địch có thể đánh úp!'], VILLAGE:['rain','MƯA RÀO!','SCH: Mưa rào trên đồng!'],
  SAVANNA:['sand','BÃO BỤI XAVAN!','SCH: Gió mùa khô cuốn bụi đỏ — tầm nhìn giảm!'], ARCTIC:['snow','BÃO TUYẾT BẮC CỰC!','SCH: Bão tuyết — bám đội hình, đừng lạc!'] };
function surge(now){ const s=SURGE[BIOME.name]; if(!s || S.weather===s[0]) return false; ENVEV.active={ kind:'weather', t0:now, dur:30, prev:S.weather||'clear' }; applyWeather(s[0]); announce(s[1], '#9fd8ff', s[2]); return true; }

export function updateEnvEvents(dt, now){
  updateRocks(dt, now); updateFall(dt, now);
  const A=ENVEV.active; if(A){ const u=(now-A.t0)/A.dur;
    if(A.kind==='flood'){ const k=u<0.15 ? u/0.15 : u>0.8 ? Math.max(0,(1-u)/0.2) : 1; RIVER.y=-0.85+0.55*k; if(RIVER.mesh) RIVER.mesh.position.y=RIVER.y; }
    if(u>=1) endActive(); }
  if(!ENVEV.next){ ENVEV.next=now+50+Math.random()*25; return; }
  if(now<ENVEV.next || ENVEV.active || ENVEV.fall || ENVEV.rocks.length) return;
  ENVEV.next=now+75+Math.random()*40; const n=BIOME.name;
  const done = (n==='VILLAGE' && Math.random()<0.6 && flood(now)) || (n==='HILLS' && Math.random()<0.7 && rockslide(now)) || (n==='CITY' && Math.random()<0.6 && collapse(now)) || surge(now);
  if(!done) ENVEV.next=now+20; }
