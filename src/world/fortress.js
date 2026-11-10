// world/fortress.js — Z107 FORTRESSES (đại bản doanh): 3–4 named strongholds a stage — crenellated walls with riflemen on top, corner watchtowers, one heavy gate to batter open, a crowded garrison + a commander inside; troops sally from the gates. Take them all to win the stage (the main citadel's gate opens last and its commander is the boss).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FORT } from '../../config.js';
import { ARENA, COVER_HP, GUNS, HF, MOBILE, PROFILE, S, ZONES, addCoins, addDiamonds, bigExplode, blocks, boss, buildTower, burst, camera, campFlagTex, diffHpMul, dropGuard, dropPowerup, enemies, fieldR, floatText, freeEnemyBar, getEnemyBar, inField, loopHpMul, loopRewardMul, makeCoverMesh, makeFlag, makeSoldierMesh, ownGun, radio, rallyFlagTex, refreshWallet, ringPulse, saveProfile, scene, sfx, showBanner, spawnDebris, spawnEnemy, spawnSquad, startBoss, towers, unwave } from '../hub.js';

export const FORTS=[];
const R2=(r)=>r[0]+Math.random()*(r[1]-r[0]), RI=(r)=>Math.round(R2(r));
export function fortsLeft(){ let n=0; for(const f of FORTS) if(!f.captured) n++; return n; }
export function mainFort(){ return FORTS.find(f=>f.tier===3); }
export function fortSealed(f){ return f.tier===3 && FORTS.some(o=>o!==f && !o.captured); }   // the citadel opens last
let _nameI=0, _fhT=0;

// ---- plan: reserve ground first (called at the top of planZones) — far side + flanks, the biggest one farthest from our spawn ----
export function planForts(){ clearForts(); const st=Math.min(4, Math.max(0, S.stage-1)), n=(MOBILE?FORT.countMobile:FORT.count)[st];
  const cand=[]; _nameI=(Math.random()*FORT.names.length)|0;
  for(let t=0;t<400 && cand.length<n;t++){ const tier = cand.length===0 ? 3 : (cand.length===1 && n>=4 ? 2 : (Math.random()<0.35?2:1)), T=FORT.tiers[tier], R=R2(T.r);
    const a=-Math.PI/2+(Math.random()-0.5)*Math.PI*(cand.length===0?0.7:1.55), FR=fieldR(a), fr=cand.length===0?0.6+Math.random()*0.15:0.45+Math.random()*0.35, d=Math.min(FR*fr, FR-R-9);   // big forts: keep the whole ring inside the fence
    const x=Math.cos(a)*d, z=Math.sin(a)*d;
    if(!inField(x, z, R+7) || Math.hypot(x,z)<R+18 || Math.hypot(x, z-ARENA*0.55)<R+40) continue;
    if(cand.some(c=>Math.hypot(c.x-x, c.z-z) < c.R+R+16)) continue;
    cand.push({ x, z, R, tier }); }
  for(const c of cand){ const f={ ...c, name:FORT.tiers[c.tier].name+' '+FORT.names[(_nameI++)%FORT.names.length], chief:'TƯỚNG '+FORT.chiefs[(Math.random()*FORT.chiefs.length)|0],
      captured:false, breached:false, active:false, units:[], cmd:null, sallyAt:0, g:null };
    FORTS.push(f); ZONES.push({ kind:'fort', x:f.x, z:f.z, r:f.R+7, fort:f }); }
}
// level the ground under the walls (craters / mounds would leave the walls floating or buried)
function flattenFort(x, z, R){ const W=HF.W, h=HF.h, R1=R+3, R2b=R+9, i0=Math.max(0,Math.floor((x-R2b+ARENA)/HF.step)), i1=Math.min(HF.N,Math.ceil((x+R2b+ARENA)/HF.step)), j0=Math.max(0,Math.floor((z-R2b+ARENA)/HF.step)), j1=Math.min(HF.N,Math.ceil((z+R2b+ARENA)/HF.step));
  let s=0, n=0; for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const px=-ARENA+i*HF.step, pz=-ARENA+j*HF.step; if(Math.hypot(px-x,pz-z)<R1){ s+=h[j*W+i]; n++; } } const base=n?s/n:0;
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const px=-ARENA+i*HF.step, pz=-ARENA+j*HF.step, d=Math.hypot(px-x,pz-z); if(d>R2b) continue; const k=d<R1?1:1-(d-R1)/(R2b-R1); h[j*W+i]+= (base-h[j*W+i])*k*k*(3-2*k); }
  HF.dj0=Math.min(HF.dj0??1e9, j0-1); HF.dj1=Math.max(HF.dj1??-1, j1+1); HF.dirty=true; return base; }

let _stone=null, _iron=null, _wood=null;
function mats(){ if(_stone) return; const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'); x.fillStyle='#8a8070'; x.fillRect(0,0,128,128);
  for(let r=0;r<8;r++) for(let k=0;k<4;k++){ const off=(r%2)*16, tone=110+Math.random()*50|0; x.fillStyle=`rgb(${tone},${tone-6},${tone-16})`; x.fillRect(k*32+off-16+1, r*16+1, 30, 14); }   // ashlar courses
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping;
  _stone=new THREE.MeshStandardMaterial({ map:t, roughness:0.92, metalness:0.02, color:0xd8ccb8 });
  _iron=new THREE.MeshStandardMaterial({ color:0x3a3632, roughness:0.45, metalness:0.8 });
  _wood=new THREE.MeshStandardMaterial({ color:0x5a3e24, roughness:0.85, metalness:0.1 }); }
// stone box with UVs scaled to world size (so the courses don't stretch along a long wall)
function stoneBox(w, h, d){ const g=new THREE.BoxGeometry(w,h,d); const uv=g.attributes.uv, p=g.attributes.position, n=g.attributes.normal;
  for(let i=0;i<uv.count;i++){ const ax=Math.abs(n.getX(i)), ay=Math.abs(n.getY(i)); const u=ax>0.5?p.getZ(i):p.getX(i), v=ay>0.5?p.getZ(i):p.getY(i); uv.setXY(i, u/4, v/4); } return g; }
function placed(g, x, y, z, ry){ g.rotateY(ry||0); g.translate(x,y,z); return g; }
const _m=new THREE.Matrix4(), _p=new THREE.Vector3(), _q=new THREE.Quaternion(), _s=new THREE.Vector3(), _up=new THREE.Vector3(0,1,0);
let _pieceGeo=null;   // one 3 m wall section (wall + footing + two merlons), scaled along x per instance
function pieceGeo(){ if(_pieceGeo) return _pieceGeo; const H=FORT.wallH, TH=FORT.wallT, L=FORT.seg;
  const parts=[placed(stoneBox(L, H+2, TH), 0, H/2-1, 0, 0), placed(stoneBox(L*0.3, 0.8, TH*0.9), -L*0.25, H+0.4, 0, 0), placed(stoneBox(L*0.3, 0.8, TH*0.9), L*0.25, H+0.4, 0, 0)];
  _pieceGeo=mergeGeometries(parts.map(q=>q.index?q.toNonIndexed():q), false); parts.forEach(q=>q.dispose()); return _pieceGeo; }

// ---- raise every planned fortress (called from buildZones, after the watchtowers) ----
export function buildForts(){ mats();
  for(const f of FORTS){ const T=FORT.tiers[f.tier], gy=flattenFort(f.x, f.z, f.R); f.gy=gy;
    const g=new THREE.Group(); g.position.set(f.x, gy, f.z); scene.add(g); f.g=g;
    const sides=T.sides[(Math.random()*T.sides.length)|0], rot=Math.random()*Math.PI, H=FORT.wallH, TH=FORT.wallT;
    const ga=Math.atan2(ARENA*0.55-f.z, -f.x);                          // the gate faces our side of the field
    const V=[]; for(let i=0;i<sides;i++){ const a=rot+i/sides*Math.PI*2; V.push([Math.cos(a)*f.R, Math.sin(a)*f.R]); }
    // the gate goes on the edge whose midpoint faces our side
    let gi=0, best=-9; for(let i=0;i<sides;i++){ const [x0,z0]=V[i], [x1,z1]=V[(i+1)%sides], m=Math.atan2((z0+z1)/2,(x0+x1)/2), c=Math.cos(m-ga); if(c>best){ best=c; gi=i; } }
    const geos=[]; f.pieces=[]; const wallHp=T.gate*FORT.wallHpK*(1+FORT.gatePerStage*(S.stage-1))*loopHpMul()*diffHpMul();
    for(let i=0;i<sides;i++){ const [x0,z0]=V[i], [x1,z1]=V[(i+1)%sides], L=Math.hypot(x1-x0,z1-z0), ry=-Math.atan2(z1-z0,x1-x0), ux=(x1-x0)/L, uz=(z1-z0)/L;
      const pieces = i===gi ? [[0, L/2-FORT.gateW/2], [L/2+FORT.gateW/2, L]] : [[0,L]];
      for(const [s0,s1] of pieces){ const len=s1-s0; if(len<0.5) continue; const n=Math.max(1, Math.round(len/FORT.seg)), pl=len/n; let prev=null;
        for(let k=0;k<n;k++){ const sc=s0+pl*(k+0.5), cx=x0+ux*sc, cz=z0+uz*sc, hp=Math.round(wallHp);      // Z107 a wall SECTION: own HP, own instance — it can be rammed / shelled down
          const pc={ i:f.pieces.length, cx, cz, ry, pl, prev, next:null }; if(prev) prev.next=pc; prev=pc; f.pieces.push(pc);
          const b={ mesh:g, x:f.x+cx, z:f.z+cz, r:Math.max(1.75, pl*0.58), hp, maxHp:hp, steel:false, loot:false, kind:'fortwall', fort:f, piece:pc }; pc.block=b; blocks.push(b); } } }
    for(const [vx,vz] of V) geos.push(placed(stoneBox(TH*1.25, H+2.6, TH*1.25), vx, (H+0.6)/2-1, vz, 0));   // corner piers (solid)
    // gatehouse: two square towers flanking the gate + a lintel over it
    { const [x0,z0]=V[gi], [x1,z1]=V[(gi+1)%sides], L=Math.hypot(x1-x0,z1-z0), ux=(x1-x0)/L, uz=(z1-z0)/L, ry=-Math.atan2(z1-z0,x1-x0), mx=(x0+x1)/2, mz=(z0+z1)/2;
      for(const s of [-1,1]){ const px=mx+ux*s*(FORT.gateW/2+1.4), pz=mz+uz*s*(FORT.gateW/2+1.4); geos.push(placed(stoneBox(2.8, H+5, 2.8), px, (H+3)/2, pz, ry));
        for(const q of [[-1,-1],[1,-1],[-1,1],[1,1]]) geos.push(placed(stoneBox(0.8,0.9,0.8), px+q[0]*1.0, H+3.45, pz+q[1]*1.0, 0)); }
      geos.push(placed(stoneBox(FORT.gateW+0.4, 1.6, TH*1.1), mx, H+0.4, mz, ry));
      const nx=-uz, nz=ux, sg=Math.sign(nx*mx+nz*mz)||1, onx=nx*sg, onz=nz*sg;                       // the outward normal (away from the centre)
      // the gate: two iron-strapped timber leaves
      const gate=new THREE.Group(); gate.position.set(mx, 0, mz); gate.rotation.y=ry; g.add(gate);
      const leaves=[]; for(const s of [-1,1]){ const lf=new THREE.Group(); lf.position.set(s*FORT.gateW/2, 0, 0); gate.add(lf);
        const door=new THREE.Mesh(new THREE.BoxGeometry(FORT.gateW/2, H-0.2, 0.55), _wood); door.position.set(-s*FORT.gateW/4, (H-0.2)/2, 0); door.castShadow=true; door.receiveShadow=true; lf.add(door);
        for(const yy of [0.7, H*0.45, H-0.9]){ const band=new THREE.Mesh(new THREE.BoxGeometry(FORT.gateW/2-0.1, 0.28, 0.66), _iron); band.position.set(-s*FORT.gateW/4, yy, 0); lf.add(band); }
        for(let k=0;k<4;k++){ const st=new THREE.Mesh(new THREE.ConeGeometry(0.11,0.4,6), _iron); st.rotation.x=Math.PI/2; st.position.set(-s*(0.4+k*0.85), H*0.6, 0.45); lf.add(st); }
        leaves.push({ g:lf, s }); }
      const gx=f.x+mx, gz=f.z+mz, gateHp=Math.round(T.gate*(1+FORT.gatePerStage*(S.stage-1))*loopHpMul()*diffHpMul());
      const b={ mesh:gate, x:gx, z:gz, r:FORT.gateW/2-0.2, hp:gateHp, maxHp:gateHp, steel:false, loot:false, kind:'gate', fort:f };
      blocks.push(b); f.gate=b; f.leaves=leaves; f.gx=gx; f.gz=gz; f.ox=gx+onx*7; f.oz=gz+onz*7;          // f.ox/oz = just outside the gate (sally point)
      f.bar=getEnemyBar(); f.bar.g.scale.setScalar(4.2); }
    const wall=new THREE.Mesh(mergeGeometries(geos.map(q=>q.index?q.toNonIndexed():q), false), _stone); geos.forEach(q=>q.dispose()); wall.castShadow=true; wall.receiveShadow=true; g.add(wall);
    { const im=new THREE.InstancedMesh(pieceGeo(), _stone, f.pieces.length); for(const pc of f.pieces){ _m.compose(_p.set(pc.cx,0,pc.cz), _q.setFromAxisAngle(_up, pc.ry), _s.set(pc.pl/FORT.seg+0.02,1,1)); im.setMatrixAt(pc.i, _m); }
      im.instanceMatrix.needsUpdate=true; im.computeBoundingSphere(); im.castShadow=true; im.receiveShadow=true; g.add(im); f.wallIM=im; }   // every wall section in ONE draw call
    // corner watchtowers (real towers: guards, collapse, loot)
    const tw=[]; for(let i=0;i<sides && tw.length<T.towers;i++){ const k=(gi+1+Math.round(i*sides/T.towers))%sides; const [vx,vz]=V[k]; tw.push([f.x+vx*0.86, f.z+vz*0.86]); }
    for(const [x,z] of tw) buildTower(x, z);
    // riflemen along the wall walk — a pseudo watchtower so they aim/fire/fall exactly like tower guards (and our men can shoot them)
    const body=new THREE.Group(); g.add(body); const guards=[], nG=Math.round(R2(T.gunners)*(MOBILE?FORT.mobileMul:1));
    for(let k=0;k<nG;k++){ const i=(k<nG*0.45) ? gi : (k%sides), [x0,z0]=V[i], [x1,z1]=V[(i+1)%sides]; let u=0.12+Math.random()*0.76; if(i===gi && Math.abs(u-0.5)<0.2) u=u<0.5?0.22:0.78;
      const s=makeSoldierMesh({enemy:true}); s.scale.setScalar(1.55); const px=x0+(x1-x0)*u, pz=z0+(z1-z0)*u; s.position.set(px*0.97, H-0.05, pz*0.97); body.add(s);
      guards.push({ g:s, alive:true, fireAt:performance.now()/1000+1+Math.random()*3 }); }
    const pt={ g, body, x:f.x, z:f.z, guards, sl:new THREE.Object3D(), beam:{ material:{ opacity:0 } }, wm:null, hp:Infinity, falling:false, fort:f };
    towers.push(pt); f.pt=pt;
    // banner of the garrison over the keep + a name board
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,9,6), _iron); pole.position.set(0, 4.5, 0); g.add(pole);
    const fl=makeFlag(campFlagTex(), 3.2, 2.0, 1); fl.position.set(0, 8.2, 0); g.add(fl); f.flag=fl;
    // inner cover: sandbag lines, crates, HESCO and concrete — room to fight, things to duck behind
    { const nC=Math.round(R2(T.cover)*(MOBILE?0.7:1)), kinds=['sandbag','crates','sandbag','hesco','concrete','drums'], gA=Math.atan2(f.gz-f.z, f.gx-f.x);
      for(let k=0,t=0;k<nC && t<nC*8;t++){ const a=Math.random()*Math.PI*2, r=f.R*(0.32+Math.random()*0.46); if(Math.abs(Math.atan2(Math.sin(a-gA),Math.cos(a-gA)))<0.35 && r>f.R*0.5) continue;   // keep the gate lane open
        const x=f.x+Math.cos(a)*r, z=f.z+Math.sin(a)*r; if(blocks.some(b=>b.fort===f && b.kind==='cover' && Math.hypot(b.x-x,b.z-z)<5)) continue;
        const kind=kinds[(Math.random()*kinds.length)|0], steel=kind==='hesco'||kind==='concrete', m=makeCoverMesh(kind, !steel); m.position.set(x, gy-0.12, z); m.rotation.y=a+Math.PI/2+(Math.random()-0.5)*0.4; scene.add(m);
        const hp=steel?Infinity:(COVER_HP[kind]||70); blocks.push({ mesh:m, x, z, r:1.7, hp, maxHp:hp, steel, loot:Math.random()<0.25, kind, fortCover:f }); k++; } }
    f.label=nameSprite(f.name, f.tier===3?'#ffb35a':'#ff8a6a'); f.label.position.set(0, 12.5, 0); g.add(f.label);
    const st0=Math.min(4,S.stage-1); f.pool={ inf:Math.round(R2(T.inf)*(MOBILE?FORT.mobileMul:1)*(1+st0*0.12)), tank:RI(T.tanks)+(st0>=3?1:0) };
    f.sallyAt=performance.now()/1000+R2(FORT.sally)*(0.6+Math.random()*0.6);
  }
}
function nameSprite(text, col){ const c=document.createElement('canvas'); c.width=512; c.height=96; const x=c.getContext('2d');
  x.fillStyle='rgba(10,6,4,.72)'; x.beginPath(); x.roundRect(8,14,496,68,14); x.fill(); x.strokeStyle=col; x.lineWidth=3; x.stroke();
  x.fillStyle=col; x.font='900 40px "Saira Condensed", Rajdhani, sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(text, 256, 50);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({ map:t, depthTest:false, transparent:true })); s.scale.set(16, 3, 1); s.renderOrder=8; return s; }

// ---- wall hits: a shot that strikes the wall top near a rifleman knocks him off ----
// ---- wall sections: shells chip them (half damage), rams crack them; a section that falls takes its weaker neighbour → a ~6 m breach ----
export function fortWallDamage(b, dmg, ram){ const f=b.fort; if(!f || !blocks.includes(b)) return; const now=performance.now()/1000;
  if(fortSealed(f)){ if(ram && (!f._sealT || now>f._sealT)){ f._sealT=now+3; floatText('TƯỜNG ĐƯỢC PHONG TOẢ — CHIẾM CÁC THÀNH KHÁC TRƯỚC', '#ffb35a', new THREE.Vector3(b.x, f.gy+7, b.z), 15); } return; }
  b.hp -= ram ? dmg : dmg*FORT.wallShotK; if(!f.active) wakeFort(f, now);
  burst({x:b.x,z:b.z}, 0xa89a84, ram?6:2, ram?6:3, {y:f.gy+1+Math.random()*3, life:0.6, size:ram?0.5:0.3, grav:-16, drag:1.4, up:2.5});
  if(b.hp<=0){ collapsePiece(f, b.piece, now); const pc=b.piece, nb=[pc.prev, pc.next].filter(q=>q && blocks.includes(q.block)).sort((a,c)=>a.block.hp-c.block.hp)[0]; if(nb) collapsePiece(f, nb, now); } }
function collapsePiece(f, pc, now){ const b=pc.block, i=blocks.indexOf(b); if(i<0) return; blocks.splice(i,1);
  _m.makeScale(0,0,0); f.wallIM.setMatrixAt(pc.i, _m); f.wallIM.instanceMatrix.needsUpdate=true;
  const pos={x:b.x, z:b.z}; bigExplode(pos, 0xc8b49a, 1.6); for(let k=0;k<4;k++) spawnDebris(pos, 1.2, 0x8a8070);
  burst(pos, 0xb8a888, 10, 4, {y:f.gy+1.5, life:1.6, size:2.6, smoke:true, grav:-0.4, drag:1.6, up:1.8, op:0.55}); S.shake=Math.min(3, S.shake+1.1); sfx('bigexplode');
  for(const gd of (f.pt?f.pt.guards:[])){ if(gd.alive && gd.wx!=null && Math.hypot(gd.wx-b.x, gd.wz-b.z)<pc.pl*0.75) dropGuard(f.pt, gd, (gd.wx-f.x)/f.R, (gd.wz-f.z)/f.R); }   // the men on it come down with it
  if(!f.breached) breachFort(f, now, true); }
// ---- ramming: the tank's closing speed into a gate / wall section (called by physics on contact) ----
export function fortRam(b, vn, t){ const R=FORT.ram, now=performance.now()/1000; if(vn<R.minV || now<(b.ramAt||0)) return; b.ramAt=now+R.cd;
  const k=Math.min(1, (vn-R.minV)/(R.fullV-R.minV))*(t&&t.ramOn?R.buffMul:1), gate=b.kind==='gate', dmg=b.maxHp*(gate?R.gate:R.wall)*k;
  if(gate) damageGate(b, dmg); else fortWallDamage(b, dmg, true);
  S.shake=Math.min(3, S.shake+0.6+k); sfx('clang'); if(t===S.player && !(b.fort && fortSealed(b.fort))) floatText((gate?'HÚC CỔNG':'HÚC TƯỜNG')+' −'+Math.round(100*(gate?R.gate:R.wall)*k)+'%', '#ffcf5a', new THREE.Vector3(b.x, (b.fort?b.fort.gy:0)+6, b.z), 18); }
export function fortWallHit(b, dmg){ fortWallDamage(b, dmg, false); const f=b.fort; if(!f || !f.pt) return; let best=null, bd=4.2;
  for(const gd of f.pt.guards){ if(!gd.alive || gd.wx==null) continue; const d=Math.hypot(gd.wx-b.x, gd.wz-b.z); if(d<bd){ bd=d; best=gd; } }
  if(best && (dmg>=12 || Math.random()<0.5)){ const p=S.player, ux=best.wx-(p?p.pos.x:0), uz=best.wz-(p?p.pos.z:0), L=Math.hypot(ux,uz)||1;
    dropGuard(f.pt, best, ux/L, uz/L); floatText('HẠ LÍNH TRÊN TƯỜNG', '#ffcf5a', new THREE.Vector3(b.x, f.gy+FORT.wallH+2, b.z), 14); } }
// ---- the gate: batter it open ----
export function damageGate(b, dmg){ const f=b.fort; if(!f || f.breached) return; const now=performance.now()/1000;
  if(fortSealed(f)){ if(!f._sealT || now>f._sealT){ f._sealT=now+3; floatText('CỔNG BỊ PHONG TOẢ — CHIẾM CÁC THÀNH KHÁC TRƯỚC', '#ffb35a', new THREE.Vector3(b.x, f.gy+7, b.z), 16); } return; }
  b.hp-=dmg; f.hitT=0.12; burst({x:b.x,z:b.z}, 0x6a4a2a, 3, 5, {y:f.gy+1+Math.random()*3, life:0.4, size:0.3, grav:-16, drag:1.5, up:2});   // splinters
  if(!f.active) wakeFort(f, now);
  if(b.hp<=0) breachFort(f, now); }
export function breachFort(f, now, viaWall){ if(f.breached) return; f.breached=true; const b=f.gate;
  if(!viaWall){ const i=blocks.indexOf(b); if(i>=0) blocks.splice(i,1); for(const L of f.leaves) L.open=0.001; f.leafV=0;   // the leaves blow inward
    bigExplode({x:b.x,z:b.z}, 0xff8a3a, 2.6); for(let k=0;k<6;k++) spawnDebris({x:b.x,z:b.z}, 1.3, 0x5a3e24); S.shake=Math.min(3, S.shake+1.6); sfx('bigexplode');
    if(f.bar){ freeEnemyBar(f.bar); f.bar=null; } }
  showBanner((viaWall?'TƯỜNG ':'CỔNG ')+f.name+(viaWall?' ĐÃ SẬP':' ĐÃ VỠ')+' — XUNG PHONG!', '#ff8a3a'); radio(f.chief+' tung toàn bộ quân giữ thành ra phản công!');
  wakeFort(f, now);
  for(const e of f.units) if(enemies.includes(e)){ e.guard=null; e.post=null; e.hold=null; }                    // the garrison pours out
  if(f.tier===3 && !boss){ startBoss(now); if(boss){ boss.pos.set(f.x, 0, f.z); boss.mesh.position.set(f.x,0,f.z); boss.fort=f; } } }   // the citadel's commander IS the stage boss
// ---- garrison: comes alive when you close in (or the gate is hit) — refilled from the fortress pool ----
function spawnInside(f, type){ const a=Math.random()*Math.PI*2, r=Math.random()*(f.R-4.5), x=f.x+Math.cos(a)*r, z=f.z+Math.sin(a)*r;
  const e=spawnEnemy(type, x, z); if(!e) return null; e.fortOf=f; if(!f.breached){ e.guard={ kind:'fort', x:f.x, z:f.z, r:f.R, fort:f }; e.post=[x,z]; e.hold={ x:f.x, z:f.z, r:f.R-3 }; }
  f.units.push(e); return e; }
export function wakeFort(f, now){ if(f.active) return; f.active=true;
  if(f.tier!==3){ const c=spawnInside(f, FORT.cmdType); if(c){ c.hp=c.maxHp=Math.round(c.maxHp*FORT.cmdHp); if(FORT.cmdScale!==1){ c.mesh.scale.multiplyScalar(FORT.cmdScale); c.r*=FORT.cmdScale; } c.commander=f; c.loot=true; f.cmd=c;
      f.escort=[]; const nE=RI(MOBILE?FORT.escortMobile:FORT.escort); for(let k=0;k<nE;k++){ const a=k/nE*Math.PI*2, r=R2(FORT.escortR), x=c.pos.x+Math.cos(a)*r, z=c.pos.z+Math.sin(a)*r;   // bodyguards ring the commander and go where he goes
        const e=spawnEnemy(k%3===2?'rpg':'rifle', x, z); if(!e) continue; e.fortOf=f; e.escortOf=c; e.escA=a; e.escR=r; e.guard={ kind:'escort', fort:f }; e.post=[x,z]; f.escort.push(e); }
      c.label=nameSprite(f.chief, '#ffd24a'); c.label.scale.set(10,1.9,1); c.label.position.set(0, 5.2/(c.mesh.scale.x||1), 0); c.label.scale.multiplyScalar(1/(c.mesh.scale.x||1)); c.mesh.add(c.label); } }
  showBanner(f.name+' BÁO ĐỘNG — '+f.chief+' TRẤN GIỮ', '#e0603a'); }
function refill(f){ const live=f.units.filter(e=>enemies.includes(e)); f.units=live; let nI=0, nT=0; for(const e of live){ if(e.def.inf) nI++; else nT++; }
  const capI=MOBILE?FORT.liveInfMobile:FORT.liveInf, capT=MOBILE?FORT.liveTanksMobile:FORT.liveTanks;
  if(nI<capI && f.pool.inf>0){ spawnInside(f, Math.random()<0.25?'rpg':'rifle'); f.pool.inf--; }
  if(nT<capT && f.pool.tank>0){ spawnInside(f, ['grunt','gunner','shield','heavy'][Math.min(3, (Math.random()*(2+Math.min(2,S.stage/2)))|0)]); f.pool.tank--; } }
// the bodyguards keep their ring round the commander (posts move with him); he falls → they fight on their own
function escortFollow(f){ if(!f.escort) return; const c=f.cmd, alive=c && enemies.includes(c);
  for(let i=f.escort.length-1;i>=0;i--){ const e=f.escort[i]; if(!enemies.includes(e)){ f.escort.splice(i,1); continue; }
    if(!alive){ e.guard=null; e.post=null; continue; } e.escA+=0.06; e.post=[c.pos.x+Math.cos(e.escA)*e.escR, c.pos.z+Math.sin(e.escA)*e.escR]; } }
// sallies: a squad or a tank marches out of the gate onto the field
function sally(f, now){ f.sallyAt=now+R2(FORT.sally)*(f.tier===3?0.8:1);
  const p=S.player; if(!p) return; let n=0; for(const e of enemies) if(!e.guard) n++; if(n > (MOBILE?16:26)) return;   // the field is already crowded
  if(Math.random()<FORT.sallyTank && f.pool.tank>0){ const e=spawnEnemy(['grunt','scout','gunner','shield'][(Math.random()*4)|0], f.ox, f.oz); if(e) f.pool.tank--; }
  else if(f.pool.inf>=3){ spawnSquad({ x:f.ox, z:f.oz }); f.pool.inf-=3; } else return;
  ringPulse(new THREE.Vector3(f.ox,0,f.oz), 0xe0603a, 2.6); }
// wave reinforcements come out of a fortress gate (most of the time) instead of over the fence
export function fortSpawnPoint(){ const alive=FORTS.filter(f=>!f.captured && f.g); if(!alive.length || Math.random()>FORT.fromGate) return null;
  const p=S.player; alive.sort((a,b)=>Math.hypot(a.ox-p.pos.x,a.oz-p.pos.z)-Math.hypot(b.ox-p.pos.x,b.oz-p.pos.z)); const f=alive[Math.random()<0.6?0:(Math.random()*alive.length)|0];
  return { x:f.ox+(Math.random()-0.5)*4, z:f.oz+(Math.random()-0.5)*4 }; }
// ---- capture: the commander is dead → the fortress is ours, its treasury opens ----
function capture(f, now){ if(f.captured) return; f.captured=true; f.active=false;
  unwave(f.flag); f.g.remove(f.flag); const fl=makeFlag(rallyFlagTex(), 3.2, 2.0, 1); fl.position.set(0, 8.2, 0); f.g.add(fl); f.flag=fl;
  if(f.label){ f.label.material.opacity=0.45; }
  for(const e of f.units) if(enemies.includes(e)){ e.guard=null; e.post=null; e.hold=null; }
  if(f.bar){ freeEnemyBar(f.bar); f.bar=null; } if(!f.breached){ f.breached=true; const i=blocks.indexOf(f.gate); if(i>=0) blocks.splice(i,1); for(const L of f.leaves) L.open=0.001; }
  const L=FORT.loot, coins=Math.round((L.coins[0]+L.coins[1]*S.stage)*f.tier*loopRewardMul()), dia=L.dia[0]+((Math.random()*(L.dia[1]-L.dia[0]+1))|0)+(f.tier>=2?1:0);
  addCoins(coins); addDiamonds(dia); refreshWallet();
  for(let k=0;k<L.drops+f.tier-1;k++) dropPowerup({ x:f.x+(Math.random()-0.5)*8, z:f.z+(Math.random()-0.5)*8 }, Math.min(3, f.tier));
  let gunTx=''; if(Math.random()<L.gunChance*f.tier){ const not=Object.keys(GUNS).filter(id=>!PROFILE.ownedGuns.includes(id) && GUNS[id].tier && GUNS[id].tier<=1+f.tier); if(not.length){ const id=not[(Math.random()*not.length)|0]; ownGun(id); gunTx=' · SÚNG MỚI: '+GUNS[id].name; } }
  saveProfile();
  bigExplode({x:f.x,z:f.z}, 0x9be04a, 1.6); ringPulse(new THREE.Vector3(f.x,0,f.z), 0x9be04a, 6); sfx('levelup');
  showBanner('ĐÃ CHIẾM '+f.name+'!  +'+coins+' xu · +'+dia+' ◆'+gunTx, '#8cbf3f');
  const left=fortsLeft(); radio(left ? ('Còn '+left+' đại bản doanh. '+(left===1 && mainFort() && !mainFort().captured ? 'Cổng '+mainFort().name+' đã mở phong toả!' : 'Tiếp tục tiến công!')) : 'Mọi đại bản doanh đã thất thủ!'); }
// the citadel falls with its commander — the stage boss (boss.js kills → stage clear)
export function fortBossDown(){ const f=mainFort(); if(f && !f.captured) capture(f, performance.now()/1000); }
// ---- per frame ----
export function updateForts(dt, now){ const p=S.player; if(!p) return; if(((now*4)|0)!==_fhT){ _fhT=(now*4)|0; updateFortHud(); }
  for(const f of FORTS){ if(!f.g) continue;
    if(f.leaves){ for(const L of f.leaves){ if(L.open){ L.open=Math.min(1, L.open+dt*1.8); L.g.rotation.y = L.s*L.open*1.45; L.g.rotation.z = L.s*L.open*0.08; } } }
    if(f.hitT>0){ f.hitT-=dt; f.gate && (f.gate.mesh.position.x += (Math.random()-0.5)*0.04); }
    if(f.bar && f.gate){ const k=Math.max(0, f.gate.hp/f.gate.maxHp); f.bar.g.position.set(f.gx, f.gy+FORT.wallH+3.6, f.gz); f.bar.g.quaternion.copy(camera.quaternion); f.bar.fill.scale.x=Math.max(0.001,k); f.bar.fill.position.x=-(1-k)*0.5; f.bar.fill.material.color.setHex(fortSealed(f)?0x7fa8ff:(k>0.5?0xffcf5a:0xff6a4a)); }
    if(f.captured) continue;
    const d=Math.hypot(p.pos.x-f.x, p.pos.z-f.z);
    if(!f.active && d<FORT.wakeR+f.R) wakeFort(f, now);
    if(f.active){ if(((now*4)|0)!==f._rt){ f._rt=(now*4)|0; refill(f); escortFollow(f); }
      for(const e of f.units){ const H=e.hold; if(!H || e.def.inf) continue; const dx=e.pos.x-H.x, dz=e.pos.z-H.z, q=Math.hypot(dx,dz); if(q>H.r){ e.pos.x=H.x+dx/q*H.r; e.pos.z=H.z+dz/q*H.r; e.vel.multiplyScalar(0.2); } }   // tanks stay behind the walls until the gate falls
      if(f.cmd && !enemies.includes(f.cmd)) capture(f, now); }
    if(now>f.sallyAt) sally(f, now);
  }
}
// HUD: one line per fortress — name · gate % / sealed / garrison stirred / ours (written only when it changes)
let _fh='';
export function updateFortHud(){ const el=document.getElementById('fortHud'); if(!el) return; if(!FORTS.length){ if(_fh){ _fh=''; el.classList.add('hidden'); } return; }
  const rows=FORTS.map(f=>{ const st=f.captured?'<em class="ok">✓ ĐÃ CHIẾM</em>':fortSealed(f)?'<em class="sl">🔒 PHONG TOẢ</em>':f.breached?'<em class="br">THỦNG THÀNH · '+(f.cmd?'DIỆT TƯỚNG':'TƯỚNG')+'</em>':'<em>CỔNG '+Math.ceil(100*Math.max(0,f.gate.hp)/f.gate.maxHp)+'%</em>';
    return '<div class="fh-r'+(f.captured?' done':'')+(f.tier===3?' main':'')+'"><b>'+f.name+'</b>'+st+'</div>'; }).join('');
  const html='<div class="fh-t">ĐẠI BẢN DOANH · '+(FORTS.length-fortsLeft())+'/'+FORTS.length+'</div>'+rows;
  if(html!==_fh){ _fh=html; el.innerHTML=html; el.classList.remove('hidden'); } }
export function clearForts(){ { const el=document.getElementById('fortHud'); if(el){ el.classList.add('hidden'); _fh=''; } } for(const f of FORTS){ if(f.g){ unwave(f.g); scene.remove(f.g); } if(f.bar){ freeEnemyBar(f.bar); f.bar=null; } } FORTS.length=0;
  for(let i=blocks.length-1;i>=0;i--) if(blocks[i].kind==='fortwall'||blocks[i].kind==='gate') blocks.splice(i,1); }
