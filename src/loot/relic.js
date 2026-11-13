// loot/relic.js — Z153 THÁNH TÍCH: one ancient relic per stage — a floating crystal over a rune plinth under a pillar of light.
//   Hold your tank inside its ring for RELIC.hold seconds to wake it (leave and it slowly fades back); the moment it starts waking
//   the enemy sends a strike team to stop you — that's the challenge. Woken, the battle freezes and you pick ONE of three big powers
//   that last until the end of the stage: +1 life, ×2 damage, hard acceleration, ×2 range, ×2 magazine, super reload, steel armour.
import * as THREE from 'three';
import { ARENA, FORTS, GUNS, MOBILE, S, burst, floatText, heightAt, hide, iconEl, inField, magCap, radio, ringPulse, scene, sfx, show, showBanner, spawnEnemy, spawnPart, updateGunHUD, updateHUD } from '../hub.js';

export const RELIC = { g:null, x:0, z:0, prog:0, alerted:false, live:false, undo:[], hold:5, r:6, t:0, parts:null };
export const BOONS = [
  { id:'life',   ic:'heart',  nm:'+1 MẠNG',        ds:'Thêm một mạng và hồi đầy máu ngay',            col:'#ff7a7a', apply(p){ p.lives++; p.hp=p.maxHp; return null; } },
  { id:'dmg',    ic:'burst',  nm:'×2 SÁT THƯƠNG',  ds:'Mọi phát bắn mạnh gấp đôi',                    col:'#ffb04a', apply(p){ p.dmgMul*=2; return ()=>{ p.dmgMul/=2; }; } },
  { id:'speed',  ic:'dash',   nm:'GIA TỐC MẠNH',   ds:'+50% tốc độ chạy · lướt hồi nhanh gấp đôi',   col:'#7fe7ff', apply(p){ p.speedMul*=1.5; p.dashCdMul*=0.5; return ()=>{ p.speedMul/=1.5; p.dashCdMul/=0.5; }; } },
  { id:'range',  ic:'target', nm:'×2 TẦM BẮN',     ds:'Bắn xa gấp đôi — ra đòn trước khi địch thấy',  col:'#9be04a', apply(p){ p.rangeMul*=2; return ()=>{ p.rangeMul/=2; }; } },
  { id:'mag',    ic:'mag',    nm:'×2 BĂNG ĐẠN',    ds:'Băng đạn mọi súng gấp đôi, nạp đầy ngay',      col:'#ffd24a', apply(p){ p.magMul=(p.magMul||1)*2; for(const gi of p.guns){ gi.ammo=magCap(GUNS[gi.id]); gi.rU=0; } return ()=>{ p.magMul/=2; for(const gi of p.guns) gi.ammo=Math.min(gi.ammo, magCap(GUNS[gi.id])); }; } },
  { id:'reload', ic:'bolt',   nm:'NẠP SIÊU TỐC',   ds:'Nạp đạn nhanh gấp 2,5 · bắn nhanh thêm 30%',  col:'#c9a8ff', apply(p){ p.reloadMul*=0.4; p.fireMul*=0.77; return ()=>{ p.reloadMul/=0.4; p.fireMul/=0.77; }; } },
  { id:'armor',  ic:'shield', nm:'GIÁP THÉP',      ds:'Giảm 40% sát thương nhận vào',                 col:'#b8c8d8', apply(p){ const a0=p.armor||0, a1=Math.min(0.85, a0+0.4); p.armor=a1; return ()=>{ p.armor=Math.max(0, (p.armor||0)-(a1-a0)); }; } },
];

let _M=null;
function mats(){ if(_M) return _M;
  const grad=(stops)=>{ const c=document.createElement('canvas'); c.width=4; c.height=128; const x=c.getContext('2d'), g=x.createLinearGradient(0,128,0,0); for(const [o,col] of stops) g.addColorStop(o,col); x.fillStyle=g; x.fillRect(0,0,4,128); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; };
  _M={ stone:new THREE.MeshStandardMaterial({ color:0x3a3630, roughness:0.85, metalness:0.1 }),
       gold:new THREE.MeshStandardMaterial({ color:0xd4a640, roughness:0.32, metalness:0.95, emissive:0x6a4410, emissiveIntensity:0.6 }),
       crystal:new THREE.MeshStandardMaterial({ color:0xfff0c0, roughness:0.08, metalness:0.2, emissive:0xffb43c, emissiveIntensity:2.6, transparent:true, opacity:0.92 }),
       rune:new THREE.MeshBasicMaterial({ color:0xffd27a, transparent:true, opacity:0.85, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }),
       beam:new THREE.MeshBasicMaterial({ map:grad([[0,'rgba(255,214,120,0.9)'],[0.25,'rgba(255,190,90,0.35)'],[1,'rgba(255,170,80,0)']]), transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false }),
       ring:new THREE.MeshBasicMaterial({ color:0xffd27a, transparent:true, opacity:0.75, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }),
       fill:new THREE.MeshBasicMaterial({ color:0xffb43c, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }) };
  return _M; }
function build(){ const M=mats(), g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.CylinderGeometry(2.0,2.4,0.7,6), M.stone); base.position.y=0.35; base.castShadow=true; base.receiveShadow=true; g.add(base);
  const step=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.8,0.45,6), M.stone); step.position.y=0.92; step.castShadow=true; g.add(step);
  const trim=new THREE.Mesh(new THREE.TorusGeometry(2.2,0.07,6,6), M.gold); trim.rotation.x=Math.PI/2; trim.position.y=0.72; g.add(trim);
  for(let i=0;i<6;i++){ const a=i/6*Math.PI*2+Math.PI/6, ob=new THREE.Mesh(new THREE.ConeGeometry(0.16,1.6,4), M.gold); ob.position.set(Math.cos(a)*1.95,1.45,Math.sin(a)*1.95); ob.castShadow=true; g.add(ob); }   // little gilded obelisks round the plinth
  const cr=new THREE.Mesh(new THREE.OctahedronGeometry(0.85,0), M.crystal); cr.scale.set(1,1.55,1); cr.position.y=3.0; g.add(cr);
  const r1=new THREE.Mesh(new THREE.TorusGeometry(1.35,0.035,6,40), M.rune), r2=new THREE.Mesh(new THREE.TorusGeometry(1.7,0.03,6,40), M.rune);
  r1.position.y=r2.position.y=3.0; g.add(r1, r2);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.75,46,16,1,true), M.beam); beam.position.y=23; beam.renderOrder=6; g.add(beam);
  const ring=new THREE.Mesh(new THREE.RingGeometry(RELIC.r-0.22, RELIC.r, 64), M.ring); ring.rotation.x=-Math.PI/2; ring.position.y=0.08; g.add(ring);
  const fill=new THREE.Mesh(new THREE.CircleGeometry(RELIC.r-0.22, 64), M.fill); fill.rotation.x=-Math.PI/2; fill.position.y=0.06; g.add(fill);
  g.userData={ cr, r1, r2, beam, ring, fill }; return g; }
// a spot in open ground, well clear of you, the forts and the field edge
function spot(){ const p=S.player; for(let i=0;i<80;i++){ const a=Math.random()*Math.PI*2, d=ARENA*(0.18+Math.random()*0.5), x=Math.cos(a)*d, z=Math.sin(a)*d;
    if(!inField(x, z, 14)) continue; if(p && Math.hypot(x-p.pos.x, z-p.pos.z) < 45) continue;
    if(FORTS.some(f=>Math.hypot(x-f.x, z-f.z) < f.R+18)) continue; return [x, z]; }
  return [0, -ARENA*0.25]; }
export function spawnRelic(){ removeRelic(); const [x,z]=spot(); const g=build(); g.position.set(x, heightAt(x,z), z); scene.add(g);
  Object.assign(RELIC, { g, x, z, prog:0, alerted:false, live:true, t:0 });
  setTimeout(()=>{ if(RELIC.live && S.mode==='playing') radio('SCH: Phát hiện THÁNH TÍCH CỔ — cột sáng vàng trên bản đồ. Giữ xe trong vòng sáng để đánh thức nó!'); }, 4500); }
export function removeRelic(){ if(RELIC.g){ scene.remove(RELIC.g); RELIC.g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); } RELIC.g=null; RELIC.live=false; relicBar(-1); }
// stage over / new run: the powers fade with the stage
export function clearRelicBoons(){ const p=S.player; for(const u of RELIC.undo) try{ u(p); }catch(e){} RELIC.undo.length=0; document.body.classList.remove('relic-on'); }
export function clearRelic(){ clearRelicBoons(); removeRelic(); }
function relicBar(k){ let el=document.getElementById('relicBar');
  if(k<0){ if(el) el.classList.remove('on'); return; }
  if(!el){ el=document.createElement('div'); el.id='relicBar'; el.innerHTML='<b>THÁNH TÍCH</b><i><u></u></i><span></span>'; document.body.appendChild(el); }
  el.classList.add('on'); el.querySelector('u').style.width=(k*100).toFixed(0)+'%'; el.querySelector('span').textContent=Math.round(k*100)+'%'; }
function challenge(){ const n=2+Math.min(3, Math.floor((S.stage||1)/2)), types=['grunt','gunner','grunt','heavy','shield'];
  for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, d=34+Math.random()*12; let x=RELIC.x+Math.cos(a)*d, z=RELIC.z+Math.sin(a)*d; if(!inField(x,z,6)){ x=RELIC.x-Math.cos(a)*d; z=RELIC.z-Math.sin(a)*d; }
    try{ const e=spawnEnemy(types[i%types.length], x, z); if(e){ e.relicGuard=true; } }catch(err){} }
  showBanner('THÁNH TÍCH ĐANG THỨC GIẤC — ĐỊCH KÉO TỚI PHÁ!', '#ffd27a'); radio('SCH: Địch phát hiện ta ở thánh tích — giữ vị trí, đừng rời vòng sáng!'); sfx('alarm'); }
export function updateRelic(dt, now){ if(!RELIC.live || !RELIC.g) return; const p=S.player, ud=RELIC.g.userData; RELIC.t+=dt; const t=RELIC.t;
  ud.cr.rotation.y+=dt*1.2; ud.cr.position.y=3.0+Math.sin(t*1.8)*0.18; ud.r1.rotation.set(Math.PI/2+Math.sin(t*0.9)*0.5, t*0.8, 0); ud.r2.rotation.set(Math.PI/2+Math.cos(t*0.7)*0.6, -t*0.6, 0);
  ud.ring.material.opacity=0.45+0.3*Math.sin(t*3); ud.beam.material.opacity=0.65+0.25*Math.sin(t*2.2)+RELIC.prog*0.4; ud.crystalK=1;
  ud.cr.material.emissiveIntensity=2.2+RELIC.prog*3+Math.sin(t*4)*0.4;
  if(Math.random() < (MOBILE?0.25:0.5)){ const a=Math.random()*6.283, r=0.5+Math.random()*1.4; spawnPart(RELIC.x+Math.cos(a)*r, RELIC.g.position.y+1.2+Math.random()*2.5, RELIC.z+Math.sin(a)*r, 0, 1.2+Math.random(), 0, { color:Math.random()<0.5?0xffe2a0:0xffb43c, size:0.22, life:1.2, grav:0.6, drag:1 }); }   // motes rising round the crystal
  if(!p || S.mode!=='playing') return;
  const inside = Math.hypot(p.pos.x-RELIC.x, p.pos.z-RELIC.z) < RELIC.r;
  if(inside){ RELIC.prog=Math.min(1, RELIC.prog+dt/RELIC.hold); if(!RELIC.alerted && RELIC.prog>0.04){ RELIC.alerted=true; challenge(); } }
  else RELIC.prog=Math.max(0, RELIC.prog-dt/(RELIC.hold*2));
  ud.fill.material.opacity=RELIC.prog*0.35; ud.ring.scale.setScalar(1+RELIC.prog*0.04);
  relicBar(RELIC.prog>0 ? RELIC.prog : -1);
  if(RELIC.prog>=1) awaken(); }
function awaken(){ RELIC.live=false; relicBar(-1); const pos=new THREE.Vector3(RELIC.x, RELIC.g.position.y+3, RELIC.z);
  ringPulse({x:RELIC.x, z:RELIC.z}, 0xffffff, RELIC.r*1.6); ringPulse({x:RELIC.x, z:RELIC.z}, 0xffd27a, RELIC.r*2.4); burst(pos, 0xffe2a0, 40, 14, { life:0.9, size:0.6, up:6, grav:-4 }); sfx('levelup');
  removeRelic(); openRelicPick(); }
export function openRelicPick(){ S.mode='relic'; const wrap=document.getElementById('relicCards'); if(!wrap){ S.mode='playing'; return; } wrap.replaceChildren();
  const pool=BOONS.slice(), pick=[]; for(let i=0;i<3;i++) pick.push(pool.splice((Math.random()*pool.length)|0,1)[0]);
  for(const b of pick){ const c=document.createElement('div'); c.className='upcard relic'; c.style.setProperty('--bc', b.col);
    const ic=document.createElement('div'); ic.className='ic'; ic.appendChild(iconEl(b.ic));
    const nm=document.createElement('div'); nm.className='nm'; nm.textContent=b.nm; const ds=document.createElement('div'); ds.className='ds'; ds.textContent=b.ds;
    const ln=document.createElement('div'); ln.className='pw'; ln.textContent='HIỆU LỰC TỚI HẾT MÀN';
    c.append(ic, nm, ds, ln); const go=()=>chooseBoon(b); c.addEventListener('click', go); c.addEventListener('touchstart', e=>{ e.preventDefault(); go(); }, {passive:false}); wrap.appendChild(c); }
  show('relicDlg'); sfx('powerup'); }
export function chooseBoon(b){ const p=S.player; hide('relicDlg'); const u=b.apply(p); if(u) RELIC.undo.push(u);
  S.mode='playing'; document.body.classList.add('relic-on'); updateHUD(); updateGunHUD(); sfx('levelup');
  if(p){ floatText(b.nm+'!', b.col, p.pos, 28); ringPulse(p.pos, parseInt(b.col.slice(1),16), 4.5); }
  showBanner('SỨC MẠNH THÁNH TÍCH: '+b.nm+' — tới hết màn', b.col); }
