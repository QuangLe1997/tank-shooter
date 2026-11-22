// campaign/surprises.js — Z223 THE FIGHT SURPRISES YOU: every minute or so, out of a weighted, stage-gated hat, something you didn't plan for —
//   · a MORTAR BARRAGE walks across your position shell by shell (red ring + whistle before each lands — keep moving)
//   · an AMBUSH: a squad (or two) rises out of the ground BEHIND you
//   · ENEMY ARMOUR swings in on your flank from far off
//   · SUICIDE VEHICLES charge in from one side
//   · a HELICOPTER of whatever kind the hat picks
//   · and sometimes the luck is ours: OUR ARTILLERY drops a fire mission on the thickest knot of enemies
import * as THREE from 'three';
import { REAL } from '../../config.js';
import { FT, S, UNDER, aoeDamage, bigExplode, clampFieldXZ, decalCrater, enemies, enemyGroundStrike, floatText, heightAt, radio, ringPulse, sfx, showBanner, spawnEnemy, spawnPart, spawnSquad, tunnelSquad } from '../hub.js';

const rnd = a => a[0]+Math.random()*(a[1]-a[0]);
export const SURP = { next:0, shells:[], last:null, count:0 };
export function resetSurprises(now){ SURP.next=(now||performance.now()/1000)+rnd(REAL.surprise.first); SURP.shells.length=0; SURP.last=null; }
export function clearSurprises(){ SURP.shells.length=0; }
function tell(t, c, r){ showBanner(t, c); if(r) radio(r); sfx('alarm'); }
const _v=new THREE.Vector3();

// ---- the events ----
function ambush(now){ const p=S.player;
  if(tunnelSquad(Math.atan2(-Math.sin(p.facing||0), -Math.cos(p.facing||0)))){ tell('⚠ PHỤC KÍCH TỪ ĐỊA ĐẠO SAU LƯNG!', '#ffb070', 'SCH: Địch chui lên từ hầm ngầm phía sau — quay lại!'); return true; }   // Z225 if they have tunnels, they come up out of one
  const C=REAL.surprise.ambush, back=Math.atan2(-(p.vel.x||Math.sin(p.aimSmoothed||0)), -(p.vel.z||Math.cos(p.aimSmoothed||0))), n=Math.round(rnd(C.squads));   // they rise behind you
  for(let k=0;k<n;k++){ const a=back+(k-(n-1)/2)*0.9+(Math.random()-0.5)*0.5, r=rnd(C.r), [x,z]=clampFieldXZ(p.pos.x+Math.sin(a)*r, p.pos.z+Math.cos(a)*r, 4);
    setTimeout(()=>{ if(S.mode==='playing'){ spawnSquad({ x, z }); for(let i=0;i<6;i++) spawnPart(x+(Math.random()-0.5)*5, heightAt(x,z)+0.4, z+(Math.random()-0.5)*5, 0, 1.2, 0, { color:0x8a7a5a, size:1.6, life:1.2, smoke:true, grav:0.1, drag:2, grow:1.6, op:0.45 }); } }, 300+k*600); }
  tell('⚠ PHỤC KÍCH SAU LƯNG!', '#ffb070', 'SCH: Bộ binh địch trồi lên phía sau — quay lại!'); return true; }
function heli(now){ const p=S.player, a=Math.random()*6.283, [x,z]=clampFieldXZ(p.pos.x+Math.cos(a)*55, p.pos.z+Math.sin(a)*55, 4); spawnEnemy('gunship', x, z);
  tell('⚠ TRỰC THĂNG ĐỊCH XUẤT HIỆN', '#ff7ae0', 'SCH: Có trực thăng địch vào trận địa — bộ binh chuẩn bị bắn phòng không!'); return true; }
function friendly(now){ const p=S.player, C=REAL.surprise.friendly; let best=null, bn=0;   // the thickest knot of enemies, well clear of our tank and our men
  for(const e of enemies){ if(e.def.air) continue; if(Math.hypot(e.pos.x-p.pos.x, e.pos.z-p.pos.z)<16) continue; let n=0; for(const o of enemies) if(!o.def.air && (o.pos.x-e.pos.x)**2+(o.pos.z-e.pos.z)**2<100) n++; if(n>bn){ bn=n; best=e; } }
  if(!best || bn<C.minFoes) return false; const cx=best.pos.x, cz=best.pos.z;
  for(const a of FT) if(Math.hypot(a.pos.x-cx, a.pos.z-cz)<12) return false;
  for(let i=0;i<10;i++) spawnPart(cx+(Math.random()-0.5)*1.5, heightAt(cx,cz)+0.5, cz+(Math.random()-0.5)*1.5, (Math.random()-0.5)*0.6, 2.2, (Math.random()-0.5)*0.6, { color:0x6aff7a, size:1.4+Math.random(), life:2.4, smoke:true, grav:0.6, drag:1.2, grow:2.4, op:0.5 });   // green marker smoke
  for(let i=0;i<C.shells;i++){ const a=Math.random()*6.283, r=Math.random()*7; SURP.shells.push({ x:cx+Math.cos(a)*r, z:cz+Math.sin(a)*r, t:2.2+i*0.32+Math.random()*0.2, warn:0, R:C.R, dmg:C.dmg, ours:true, pulse:0, wh:false }); }
  tell('PHÁO TA CHI VIỆN!', '#9be04a', 'PHÁO BINH: Đã nhận toạ độ khói xanh — bắn hiệu quả, chú ý!'); floatText('KHÓI XANH — PHÁO TA', '#9be04a', { x:cx, y:heightAt(cx,cz)+3, z:cz }, 15); return true; }
const EV = { ambush, heli, friendly };

function roll(now){ const C=REAL.surprise, live=enemies.length, pool=[];
  for(const k in EV){ if(S.stage<(C.from[k]||1) || k===SURP.last) continue;
    if(live>110 && k!=='friendly') continue; if((C.w[k]??1)>0) pool.push([k, C.w[k]??1]); }
  if(!pool.length) return null; let tot=0; for(const [,w] of pool) tot+=w; let r=Math.random()*tot;
  for(const [k,w] of pool){ r-=w; if(r<=0){ if(EV[k](now)){ SURP.last=k; SURP.count++; return k; } break; } }
  return null; }
export function updateSurprises(dt, now){ if(UNDER.on) return;   // Z226
  for(let i=SURP.shells.length-1;i>=0;i--){ const s=SURP.shells[i]; s.t-=dt;
    if(!s.ours && s.t<s.warn){ s.pulse-=dt; if(s.pulse<=0){ s.pulse=0.32; ringPulse(_v.set(s.x, 0, s.z), 0xff3a2a, s.R*0.7); } }   // red ring blinks where it will land
    if(!s.wh && s.t<0.8){ s.wh=true; sfx('whistle', _v.set(s.x, 0, s.z)); }
    if(s.t<=0){ SURP.shells.splice(i,1); if(S.mode!=='playing') continue; decalCrater(s.x, s.z, 1.1, 0.8);
      if(s.ours){ aoeDamage(s.x, s.z, s.R, s.dmg, false, now, 'HE', false); bigExplode({ x:s.x, z:s.z }, 0xffae5c, 1.5); }
      else enemyGroundStrike(s.x, s.z, s.R, s.dmg, now); } }
  if(S.mode!=='playing' || !S.player) return;
  if(!SURP.next) SURP.next=now+rnd(REAL.surprise.first);
  if(now<SURP.next) return; SURP.next=now+rnd(REAL.surprise.every); roll(now); }
