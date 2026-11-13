// world/fortress.js — Z107 FORTRESSES (đại bản doanh): 3–4 named strongholds a stage — crenellated walls with riflemen on top, corner watchtowers, one heavy gate to batter open, a crowded garrison + a commander inside; troops sally from the gates. Take them all to win the stage (the main citadel's gate opens last and its commander is the boss).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FORT, COMMAND, GUN_MODS } from '../../config.js';
import { ALLY_TANKS, ARENA, BIOME, BIOME_PLACE, COVER_HP, FT, GUNS, HF, MOBILE, POWERUPS, PROFILE, S, ZONES, addCoins, addDiamonds, bigExplode, blocks, boss, buildTower, burst, camera, campFlagTex, capGeo, capMat, celebrate, damageBlock, detailize, diffHpMul, dropGuard, dropPowerup, enemies, fieldR, floatText, fortStyle, freeEnemyBar, getEnemyBar, haptic, heightAt, inField, loopHpMul, loopRewardMul, makeCoverMesh, makeFlag, makeSoldierMesh, makeSquad, modDrop, ownGun, propTex, radio, rallyFlagTex, refreshWallet, riders, ringPulse, saveProfile, scene, sfx, showBanner, spawnDebris, spawnEnemy, spawnPart, spawnSquad, startBoss, towerRoof, towers, unwave, vnTex, wallMat } from '../hub.js';

export const FORTS=[];
const R2=(r)=>r[0]+Math.random()*(r[1]-r[0]), RI=(r)=>Math.round(R2(r));
export function fortsLeft(){ let n=0; for(const f of FORTS) if(!f.captured) n++; return n; }
export function mainFort(){ return FORTS.find(f=>f.tier===3); }
export function fortSealed(f){ return f.tier===3 && FORTS.some(o=>o!==f && !o.captured); }   // the citadel opens last
let _nameI=0, _fhT=0;

// ---- plan: reserve ground first (called at the top of planZones) — far side + flanks, the biggest one farthest from our spawn ----
export function planForts(){ clearForts(); const st=Math.min(4, Math.max(0, S.stage-1)), n=(MOBILE?FORT.countMobile:FORT.count)[st];
  const cand=[], NM=(BIOME_PLACE[BIOME.name]||{}).forts||FORT.names; _nameI=(Math.random()*NM.length)|0;   // Z170 real place names of this land
  for(let t=0;t<400 && cand.length<n;t++){ const tier = cand.length===0 ? 3 : (cand.length===1 && n>=4 ? 2 : (Math.random()<0.35?2:1)), T=FORT.tiers[tier], R=R2(T.r);
    const a=-Math.PI/2+(Math.random()-0.5)*Math.PI*(cand.length===0?0.7:1.55), FR=fieldR(a), fr=cand.length===0?0.6+Math.random()*0.15:0.45+Math.random()*0.35, d=Math.min(FR*fr, FR-R-9);   // big forts: keep the whole ring inside the fence
    const x=Math.cos(a)*d, z=Math.sin(a)*d;
    if(!inField(x, z, R+7) || Math.hypot(x,z)<R+18 || Math.hypot(x, z-ARENA*0.55)<R+40) continue;
    if(cand.some(c=>Math.hypot(c.x-x, c.z-z) < c.R+R+34)) continue;   // Z144 wide gaps between strongholds
    cand.push({ x, z, R, tier }); }
  for(const c of cand){ const f={ ...c, name:FORT.tiers[c.tier].name+' '+NM[(_nameI++)%NM.length], chief:'TƯỚNG '+FORT.chiefs[(Math.random()*FORT.chiefs.length)|0],
      captured:false, breached:false, active:false, units:[], cmd:null, sallyAt:0, g:null };
    FORTS.push(f); ZONES.push({ kind:'fort', x:f.x, z:f.z, r:f.R+7, fort:f }); }
}
// level the ground under the walls (craters / mounds would leave the walls floating or buried)
function flattenFort(x, z, R){ const W=HF.W, h=HF.h, R1=R+3, R2b=R+9, i0=Math.max(0,Math.floor((x-R2b+ARENA)/HF.step)), i1=Math.min(HF.N,Math.ceil((x+R2b+ARENA)/HF.step)), j0=Math.max(0,Math.floor((z-R2b+ARENA)/HF.step)), j1=Math.min(HF.N,Math.ceil((z+R2b+ARENA)/HF.step));
  let s=0, n=0; for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const px=-ARENA+i*HF.step, pz=-ARENA+j*HF.step; if(Math.hypot(px-x,pz-z)<R1){ s+=h[j*W+i]; n++; } } const base=n?s/n:0;
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const px=-ARENA+i*HF.step, pz=-ARENA+j*HF.step, d=Math.hypot(px-x,pz-z); if(d>R2b) continue; const k=d<R1?1:1-(d-R1)/(R2b-R1); h[j*W+i]+= (base-h[j*W+i])*k*k*(3-2*k); }
  HF.dj0=Math.min(HF.dj0??1e9, j0-1); HF.dj1=Math.max(HF.dj1??-1, j1+1); HF.dirty=true; return base; }

let _stone=null, _iron=null, _wood=null, _ban=null;
function bannerMat(){ return _ban||(_ban=new THREE.MeshStandardMaterial({ map:campFlagTex(), color:0xd8c8c0, roughness:0.9, side:THREE.DoubleSide })); }   // Z145 enemy war banner
function mats(){ if(_stone) return; const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'); x.fillStyle='#8a8070'; x.fillRect(0,0,128,128);
  for(let r=0;r<8;r++) for(let k=0;k<4;k++){ const off=(r%2)*16, tone=110+Math.random()*50|0; x.fillStyle=`rgb(${tone},${tone-6},${tone-16})`; x.fillRect(k*32+off-16+1, r*16+1, 30, 14); }   // ashlar courses
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping;
  _stone=detailize(new THREE.MeshStandardMaterial({ map:t, roughness:0.92, metalness:0.02, color:0xd8ccb8 }));
  _iron=detailize(new THREE.MeshStandardMaterial({ color:0x3a3632, roughness:0.45, metalness:0.8 }), { scale:0.9, bump:0.006, alb:0.35, foot:0, streak:0.35 });   // Z145 rust bloom + run-off
  _wood=detailize(new THREE.MeshStandardMaterial({ color:0x5a3e24, roughness:0.85, metalness:0.1, map:propTex('wood') }), { scale:0.7, bump:0.015, alb:0.3, foot:0.8, streak:0.2 }); }
// stone box with UVs scaled to world size (so the courses don't stretch along a long wall)
function stoneBox(w, h, d){ const g=new THREE.BoxGeometry(w,h,d); const uv=g.attributes.uv, p=g.attributes.position, n=g.attributes.normal;
  for(let i=0;i<uv.count;i++){ const ax=Math.abs(n.getX(i)), ay=Math.abs(n.getY(i)); const u=ax>0.5?p.getZ(i):p.getX(i), v=ay>0.5?p.getZ(i):p.getY(i); uv.setXY(i, u/4, v/4); } return g; }
function cylUV(g, circ, h){ const uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*circ/4, uv.getY(i)*h/4); return g; }   // Z145 courses keep their size round a drum
function placed(g, x, y, z, ry){ g.rotateY(ry||0); g.translate(x,y,z); return g; }
const _m=new THREE.Matrix4(), _p=new THREE.Vector3(), _q=new THREE.Quaternion(), _s=new THREE.Vector3(), _up=new THREE.Vector3(0,1,0);
let _pieceGeo=null;   // one 3 m wall section (wall + footing + two merlons), scaled along x per instance
function pieceGeo(){ if(_pieceGeo) return _pieceGeo; const H=FORT.wallH, TH=FORT.wallT, L=FORT.seg;
  const parts=[placed(stoneBox(L, H+2, TH), 0, H/2-1, 0, 0), placed(stoneBox(L*0.3, 0.8, TH*0.9), -L*0.25, H+0.4, 0, 0), placed(stoneBox(L*0.3, 0.8, TH*0.9), L*0.25, H+0.4, 0, 0)];
  // Z145 real masonry has a profile: a battered plinth, a string course, a projecting parapet on corbels, coped merlons
  parts.push(placed(stoneBox(L, 1.3, TH+0.7), 0, 0.2, 0, 0), placed(stoneBox(L, 0.5, TH+0.36), 0, 0.95, 0, 0));
  parts.push(placed(stoneBox(L, 0.22, TH+0.22), 0, H*0.52, 0, 0));
  parts.push(placed(stoneBox(L, 0.42, TH+0.5), 0, H-0.2, 0, 0));
  for(let k=0;k<4;k++) for(const sd of [-1,1]) parts.push(placed(stoneBox(0.3, 0.5, 0.25), -L/2+L*(k+0.5)/4, H-0.62, sd*(TH/2+0.12), 0));
  for(const sx of [-L*0.25, L*0.25]) parts.push(placed(stoneBox(L*0.3+0.14, 0.12, TH*0.9+0.14), sx, H+0.86, 0, 0));
  _pieceGeo=mergeGeometries(parts.map(q=>q.index?q.toNonIndexed():q), false); parts.forEach(q=>q.dispose()); return _pieceGeo; }

// ---- raise every planned fortress (called from buildZones, after the watchtowers) ----
export function buildForts(){ mats(); let fi=Math.floor(Math.random()*6);   // Z140 the walls are built the way this land builds them — and no two forts alike
  for(const f of FORTS){ const ST=fortStyle(BIOME.name, fi++), WM=wallMat(ST); f.style=ST; const T=FORT.tiers[f.tier], gy=flattenFort(f.x, f.z, f.R); f.gy=gy;
    const g=new THREE.Group(); g.position.set(f.x, gy, f.z); scene.add(g); f.g=g;
    const sides=T.sides[(Math.random()*T.sides.length)|0], rot=Math.random()*Math.PI, H=FORT.wallH, TH=FORT.wallT;
    const ga=Math.atan2(ARENA*0.55-f.z, -f.x);                          // the gate faces our side of the field
    // Z145 a real fort follows its ground, not a compass: an IRREGULAR outline — every corner at its own angle and distance (never a neat hexagon) —
    //   re-rolled until the gate wall is long enough for the gatehouse
    let V=[]; for(let tries=0;tries<12;tries++){ V=[]; for(let i=0;i<sides;i++){ const a=rot+(i+(Math.random()-0.5)*0.5)/sides*Math.PI*2, rr=f.R*(0.88+Math.random()*0.18); V.push([Math.cos(a)*rr, Math.sin(a)*rr]); }
      let ok=true; for(let i=0;i<sides;i++){ const [x0,z0]=V[i], [x1,z1]=V[(i+1)%sides]; if(Math.hypot(x1-x0,z1-z0) < FORT.gateW+12) ok=false; } if(ok) break; }
    f.Rin=Math.min(...V.map((v,i)=>{ const w=V[(i+1)%sides], L=Math.hypot(w[0]-v[0],w[1]-v[1]); return Math.abs(v[0]*w[1]-v[1]*w[0])/L; }));   // nearest wall to the centre
    // the gate goes on the edge whose midpoint faces our side
    let gi=0, best=-9; for(let i=0;i<sides;i++){ const [x0,z0]=V[i], [x1,z1]=V[(i+1)%sides], m=Math.atan2((z0+z1)/2,(x0+x1)/2), c=Math.cos(m-ga); if(c>best){ best=c; gi=i; } }
    const geos=[]; f.pieces=[]; const wallHp=T.gate*FORT.wallHpK*(1+FORT.gatePerStage*(S.stage-1))*loopHpMul()*diffHpMul();
    for(let i=0;i<sides;i++){ const [x0,z0]=V[i], [x1,z1]=V[(i+1)%sides], L=Math.hypot(x1-x0,z1-z0), ry=-Math.atan2(z1-z0,x1-x0), ux=(x1-x0)/L, uz=(z1-z0)/L;
      const pieces = i===gi ? [[0, L/2-FORT.gateW/2], [L/2+FORT.gateW/2, L]] : [[0,L]];
      for(const [s0,s1] of pieces){ const len=s1-s0; if(len<0.5) continue; const n=Math.max(1, Math.round(len/FORT.seg)), pl=len/n; let prev=null;
        for(let k=0;k<n;k++){ const sc=s0+pl*(k+0.5), cx=x0+ux*sc, cz=z0+uz*sc, hp=Math.round(wallHp);      // Z107 a wall SECTION: own HP, own instance — it can be rammed / shelled down
          const pc={ i:f.pieces.length, cx, cz, ry, pl, prev, next:null, ux, uz }; if(prev) prev.next=pc; prev=pc; f.pieces.push(pc);
          const b={ mesh:g, x:f.x+cx, z:f.z+cz, r:Math.max(1.75, pl*0.58), hp, maxHp:hp, steel:false, loot:false, kind:'fortwall', fort:f, piece:pc }; pc.block=b; blocks.push(b); } } }
    const dk=[], wd=[];                                                                                    // Z145 dark iron (slits, portcullis) · timber
    const slit=(x,y,z,ry)=>dk.push(placed(new THREE.BoxGeometry(0.24,1.1,0.12), x, y, z, ry));
    // Z145 a stone tower: battered two-step plinth, string courses, a projecting machicolation gallery on corbels, merlons, arrow slits on its outer faces
    const keep=(px,pz,ry,ox,oz,TW,TH2,nm=3)=>{ geos.push(placed(stoneBox(TW, TH2+1, TW), px, (TH2-1)/2, pz, ry), placed(stoneBox(TW+1.0, 1.8, TW+1.0), px, 0.3, pz, ry), placed(stoneBox(TW+0.5, 0.6, TW+0.5), px, 1.3, pz, ry));
      for(const y of [H*0.52, H+2.4]) geos.push(placed(stoneBox(TW+0.24, 0.26, TW+0.24), px, y, pz, ry));
      geos.push(placed(stoneBox(TW+0.9, 0.6, TW+0.9), px, TH2-0.9, pz, ry));
      const tx=Math.cos(-ry), tz=Math.sin(-ry), at=(l,o)=>[px+tx*l+ox*o, pz+tz*l+oz*o];
      for(const [lx,lz] of [[1,0],[-1,0],[0,1],[0,-1]]) for(const t of (nm>4?[-0.42,-0.3,-0.18,-0.06,0.06,0.18,0.3,0.42]:[-0.36,-0.12,0.12,0.36])){ const [cx,cz]=at(lx?lx*(TW/2+0.16):t*TW*1.3, lz?lz*(TW/2+0.16):t*TW*1.3); geos.push(placed(stoneBox(0.3,0.6,0.3), cx, TH2-1.5, cz, ry)); }
      const E=(TW+0.9)/2-0.2; for(const [lx,lz] of [[1,0],[-1,0],[0,1],[0,-1]]) for(let q=0;q<nm;q++){ const t=nm>1?-1+2*q/(nm-1):0, [cx,cz]=at(lx?lx*E:t*E*0.8, lz?lz*E:t*E*0.8); geos.push(placed(stoneBox(0.62,0.95,0.62), cx, TH2-0.12, cz, ry)); }
      for(const y of [H*0.35, H+1.3, TH2-2.9]) for(const l of (nm>4?[-TW*0.3,0,TW*0.3]:[0])) for(const [a1,a2] of (nm>4?[[0,1],[0,-1],[1,0],[-1,0]]:[[0,1]])){ const [sx,sz]=at(a1?a1*(TW/2+0.03):l, a2?a2*(TW/2+0.03):l); slit(sx, y, sz, a1?ry+Math.PI/2:ry); }
      const rf=new THREE.Mesh(towerRoof(ST, TW-0.2, TH2+0.4), capMat); rf.position.set(px,0,pz); rf.rotation.y=ry; rf.castShadow=true; g.add(rf); };
    V.forEach(([vx,vz],vi)=>{ const L=Math.hypot(vx,vz), ox=vx/L, oz=vz/L, ry=-Math.atan2(-ox,oz), tall = vi%2===0 || sides<=6 && vi%3===1;   // Z145 every other corner is a TALL tower
      if(tall && !ST.round) keep(vx, vz, ry, ox, oz, 3.6, H+6.5);
      else if(ST.round){ const hh=tall?H+7:H+3.6, rr=tall?2.3:1.9, dr=cylUV(new THREE.CylinderGeometry(rr, rr+0.3, hh, 28), 14, hh); dr.translate(vx, hh/2-1, vz); geos.push(dr);   // Z140 round drum towers on alternate forts
        for(const [r0,r1,h2,yy] of [[rr+0.7,rr+0.85,1.6,0.3],[rr+0.25,rr+0.3,0.26,H*0.55],[rr+0.45,rr+0.25,0.55,hh-1.9]]){ const ring=cylUV(new THREE.CylinderGeometry(r0,r1,h2,28), 14, h2); ring.translate(vx,yy,vz); geos.push(ring); }   // plinth · string course · corbel ring
        for(let k=0;k<10;k++){ const a=k/10*6.283; geos.push(placed(stoneBox(0.6,0.95,0.55), vx+Math.cos(a)*(rr+0.2), hh-0.6, vz+Math.sin(a)*(rr+0.2), -a)); }   // merlon ring
        for(const y of tall?[H*0.4,H+2,H+4.6]:[H*0.45]) slit(vx+ox*(rr+0.32), y, vz+oz*(rr+0.32), ry);
        const rf=new THREE.Mesh(towerRoof(ST, rr*1.8, hh-0.6), capMat); rf.position.set(vx,0,vz); rf.castShadow=true; g.add(rf); }
      else { geos.push(placed(stoneBox(TH*1.25, H+2.6, TH*1.25), vx, (H+0.6)/2-1, vz, 0)); geos.push(placed(stoneBox(TH*1.25+0.8, 1.3, TH*1.25+0.8), vx, 0.2, vz, 0), placed(stoneBox(TH*1.25+0.4, 0.4, TH*1.25+0.4), vx, H+1.2, vz, 0)); } });   // corner pier · plinth + cornice
    // Z145 THE GATEHOUSE: two tall keeps standing proud of the wall, a fighting gallery bridging the gate, a raised portcullis with its teeth showing,
    //   war banners down the towers, fire braziers and chevaux-de-frise out front — the face of the fort
    { const [x0,z0]=V[gi], [x1,z1]=V[(gi+1)%sides], L=Math.hypot(x1-x0,z1-z0), ux=(x1-x0)/L, uz=(z1-z0)/L, ry=-Math.atan2(z1-z0,x1-x0), mx=(x0+x1)/2, mz=(z0+z1)/2;
      const nx=-uz, nz=ux, sg=Math.sign(nx*mx+nz*mz)||1, onx=nx*sg, onz=nz*sg;                       // the outward normal (away from the centre)
      const CAP=f.tier===3, GH=H+(CAP?12:8.5), TW=CAP?4.4:3.6, off=FORT.gateW/2+TW/2, at=(l,o)=>[mx+ux*l+onx*o, mz+uz*l+onz*o];
      for(const sd of [-1,1]){ const [px,pz]=at(sd*off, 0.7); keep(px, pz, ry, onx, onz, TW, GH);
        const ban=new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4.2), bannerMat()); const [bx,bz]=at(sd*off, 0.7+TW/2+0.05); ban.position.set(bx, GH-4.4, bz); ban.rotation.y=Math.atan2(onx,onz); g.add(ban);
        const [hx,hz]=at(sd*off, 0.7+TW/2+0.12); dk.push(placed(new THREE.BoxGeometry(1.8,0.14,0.14), hx, GH-2.25, hz, ry));                                  // banner pole
        const [fx,fz]=at(sd*(off+TW/2+1.6), TH/2+2.4); dk.push(placed(new THREE.CylinderGeometry(0.1,0.16,1.5,8), fx, 0.75, fz, 0), placed(new THREE.CylinderGeometry(0.6,0.3,0.45,12), fx, 1.65, fz, 0));
        for(const [r,h,c] of [[0.42,1.1,0xff7a1e],[0.24,0.8,0xffe08a]]){ const fl=new THREE.Mesh(new THREE.ConeGeometry(r,h,8), new THREE.MeshBasicMaterial({ color:c })); fl.position.set(fx, 1.85+h/2, fz); g.add(fl); }   // brazier fire
        for(let k=0;k<3;k++){ const [cx,cz]=at(sd*(off-1.2+k*1.4), TH/2+5.2); for(const q of [-0.7,0.7]){ const st=new THREE.CylinderGeometry(0.08,0.1,3.0,6); st.rotateZ(q); st.rotateY(ry); st.translate(cx, 0.9, cz); wd.push(st); } } }   // chevaux-de-frise
      // fighting gallery over the gate: deep, corbelled out, crenellated
      { const [gx2,gz2]=at(0, 0.3); geos.push(placed(stoneBox(FORT.gateW+0.8, 2.6, TH*1.6), gx2, H+1.1, gz2, ry)); }
      for(let k=0;k<5;k++){ const l=-FORT.gateW/2+0.6+k*(FORT.gateW-1.2)/4, [cx,cz]=at(l, 0.3+TH*0.8+0.2); geos.push(placed(stoneBox(0.9,0.95,0.5), cx, H+2.87, cz, ry)); const [kx,kz]=at(l, 0.3+TH*0.8+0.12); geos.push(placed(stoneBox(0.32,0.6,0.28), kx, H+0.05, kz, ry)); }
      { const [ex,ez]=at(0, 0.3+TH*0.8+0.06); geos.push(placed(stoneBox(1.8,1.5,0.2), ex, H+1.2, ez, ry)); }                                        // carved crest
      // portcullis, raised: its lower bars and teeth hang below the gallery
      for(let k=0;k<=9;k++){ const l=-FORT.gateW/2+0.35+k*(FORT.gateW-0.7)/9, [bx,bz]=at(l, 0.62); dk.push(placed(new THREE.BoxGeometry(0.1,1.5,0.1), bx, H-0.95, bz, ry));
        const t=new THREE.ConeGeometry(0.09,0.4,5); t.rotateX(Math.PI); t.translate(bx, H-1.9, bz); dk.push(t); }
      for(const y of [H-1.4, H-0.6]){ const [hx,hz]=at(0, 0.62); dk.push(placed(new THREE.BoxGeometry(FORT.gateW-0.5,0.1,0.1), hx, y, hz, ry)); }
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
      f.ix=gx-onx*7; f.iz=gz-onz*7; f.gux=ux; f.guz=uz; f.gateShut=true; f.gv=0; f.openUntil=0; f.posture='idle'; f.postAt=0;   // Z111b f.ix/iz = just inside: troops form up here, the gate swings open, they march out
      f.bar=getEnemyBar(); f.bar.g.scale.setScalar(4.2); }
    // Z145 THE CAPITAL: the citadel raises a great DONJON at the back of its ward — an 11 m square keep, 18 m high, with four 23 m corner turrets,
    //   war banners on every face and the garrison's flag flying from its roof. It is solid stone: shells glance off it.
    if(f.tier===3){ const bx=f.x-f.gx, bz=f.z-f.gz, bl=Math.hypot(bx,bz)||1, ox=bx/bl, oz=bz/bl, d=f.Rin*0.42, kx=ox*d, kz=oz*d, ry=-Math.atan2(-ox,oz), KW=11, KH=18;
      keep(kx, kz, ry, ox, oz, KW, KH, 7);
      const tx=Math.cos(-ry), tz=Math.sin(-ry); for(const a of [-1,1]) for(const b of [-1,1]) keep(kx+tx*a*KW/2+ox*b*KW/2, kz+tz*a*KW/2+oz*b*KW/2, ry, ox, oz, 3.4, KH+5);
      for(const [a,b] of [[0,1],[0,-1],[1,0],[-1,0]]){ const ban=new THREE.Mesh(new THREE.PlaneGeometry(2.2, 6.5), bannerMat()); ban.position.set(kx+tx*a*(KW/2+0.32)+ox*b*(KW/2+0.32), KH-6, kz+tz*a*(KW/2+0.32)+oz*b*(KW/2+0.32)); ban.rotation.y=Math.atan2(tx*a+ox*b, tz*a+oz*b); g.add(ban); }
      { const [sx,sz]=[kx-ox*(KW/2+1.2), kz-oz*(KW/2+1.2)]; for(let k=0;k<6;k++) geos.push(placed(stoneBox(4.2, 0.5*(k+1), 0.9), sx-ox*(5-k)*0.9, 0.25*(k+1), sz-oz*(5-k)*0.9, ry)); }   // the great stair to the keep door
      { const [dx,dz]=[kx-ox*(KW/2+0.06), kz-oz*(KW/2+0.06)]; const door=new THREE.Mesh(new THREE.BoxGeometry(2.6,4.2,0.2), _wood); door.position.set(dx, 2.1+3, dz); door.rotation.y=ry; g.add(door); }
      f.keepX=kx; f.keepZ=kz; f.keepY=KH+0.4; f.keepR=KW*0.72;
      const kb=new THREE.Group(); kb.position.set(kx,0,kz); g.add(kb); blocks.push({ mesh:kb, x:f.x+kx, z:f.z+kz, r:KW*0.72, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'keep' }); }
    const wall=new THREE.Mesh(mergeGeometries(geos.map(q=>q.index?q.toNonIndexed():q), false), WM); geos.forEach(q=>q.dispose()); wall.castShadow=true; wall.receiveShadow=true; g.add(wall);
    for(const [arr,mt] of [[dk,_iron],[wd,_wood]]) if(arr.length){ const m=new THREE.Mesh(mergeGeometries(arr.map(q=>q.index?q.toNonIndexed():q), false), mt); arr.forEach(q=>q.dispose()); m.castShadow=true; g.add(m); }   // Z145
    { const im=new THREE.InstancedMesh(pieceGeo(), WM, f.pieces.length); for(const pc of f.pieces){ _m.compose(_p.set(pc.cx,0,pc.cz), _q.setFromAxisAngle(_up, pc.ry), _s.set(pc.pl/FORT.seg+0.02,1,1)); im.setMatrixAt(pc.i, _m); }
      im.instanceMatrix.needsUpdate=true; im.computeBoundingSphere(); im.castShadow=true; im.receiveShadow=true; g.add(im); f.wallIM=im;
      const cg=capGeo(ST, H, TH, FORT.seg); if(cg){ const ci=new THREE.InstancedMesh(cg, capMat, f.pieces.length); for(const pc of f.pieces){ im.getMatrixAt(pc.i, _m); ci.setMatrixAt(pc.i, _m); } ci.instanceMatrix.needsUpdate=true; ci.computeBoundingSphere(); ci.castShadow=true; g.add(ci); f.capIM=ci; } }   // every wall section in ONE draw call · Z140 + its regional cap (stakes / snow / wire / tiles)
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
    { const PH=f.tier===3?22:16, fg=new THREE.Group(); g.add(fg); f.flagG=fg; f.flagH=PH;                      // Z140 a tall flagpole over the keep (it topples when the fort falls)
      const base=new THREE.Mesh(new THREE.CylinderGeometry(0.9,1.2,1.2,10), _iron); base.position.set(f.keepX||0, (f.keepY||0)+0.6, f.keepZ||0); g.add(base); fg.position.set(f.keepX||0, f.keepY||0, f.keepZ||0);   // Z145 the capital's flag flies from the donjon roof
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.16,PH,8), _iron); pole.position.set(0, PH/2, 0); pole.castShadow=true; fg.add(pole);
      const ball=new THREE.Mesh(new THREE.SphereGeometry(0.28,10,8), new THREE.MeshStandardMaterial({ color:0xc8a040, metalness:0.8, roughness:0.3 })); ball.position.y=PH+0.2; fg.add(ball);
      const fl=makeFlag(campFlagTex(), f.tier===3?5.4:4.4, f.tier===3?3.4:2.8, 1); fl.position.set(0, PH-1.8, 0); fg.add(fl); f.flag=fl; }
    // inner cover: sandbag lines, crates, HESCO and concrete — room to fight, things to duck behind
    { const nC=Math.round(R2(T.cover)*(MOBILE?0.7:1)), kinds=['sandbag','crates','sandbag','hesco','concrete','drums'], gA=Math.atan2(f.gz-f.z, f.gx-f.x);
      for(let k=0,t=0;k<nC && t<nC*8;t++){ const a=Math.random()*Math.PI*2, r=f.R*(0.32+Math.random()*0.46); if(Math.abs(Math.atan2(Math.sin(a-gA),Math.cos(a-gA)))<0.35 && r>f.R*0.5) continue;   // keep the gate lane open
        const x=f.x+Math.cos(a)*r, z=f.z+Math.sin(a)*r; if(blocks.some(b=>b.fort===f && b.kind==='cover' && Math.hypot(b.x-x,b.z-z)<5)) continue; if(f.keepR && Math.hypot(x-f.x-f.keepX, z-f.z-f.keepZ)<f.keepR+4) continue;
        const kind=kinds[(Math.random()*kinds.length)|0], steel=kind==='hesco'||kind==='concrete', m=makeCoverMesh(kind, !steel); m.position.set(x, gy-0.12, z); m.rotation.y=a+Math.PI/2+(Math.random()-0.5)*0.4; scene.add(m);
        const hp=steel?Infinity:(COVER_HP[kind]||70); blocks.push({ mesh:m, x, z, r:1.7, hp, maxHp:hp, steel, loot:Math.random()<0.25, kind, fortCover:f }); k++; } }
    f.label=nameSprite(f.name, f.tier===3?'#ffb35a':'#ff8a6a'); f.label.position.set(f.keepX||0, (f.flagH||12)+(f.keepY||0)+3, f.keepZ||0); g.add(f.label);
    buildHatches(f);
    const st0=Math.min(4,S.stage-1); f.pool={ inf:Math.round(R2(T.inf)*(MOBILE?FORT.mobileMul:1)*(1+st0*0.12)), tank:RI(T.tanks)+(st0>=3?1:0) };
    f.sallyAt=performance.now()/1000+R2(FORT.sally)*(0.6+Math.random()*0.6);
    f.tunnel = f.tier===3 ? 0 : FORT.tunnel[f.tier-1]+(S.stage>=4?1:0);   // Z170 squads still hiding in the tunnels when the yard is cleared
  }
}
// Z170 BASEMENT HATCHES: the garrison waits below ground in squads; each squad climbs out of a hatch in the yard (iron lid flung open, dust)
function makeHatch(f, wx, wz){ const g=new THREE.Group(), y=heightAt(wx, wz)-f.gy; g.position.set(wx-f.x, y, wz-f.z); g.rotation.y=Math.random()*Math.PI; f.g.add(g);
  const fr=new THREE.Mesh(mergeGeometries([placed(stoneBox(2.6,0.36,0.5),0,0.12,1.05,0), placed(stoneBox(2.6,0.36,0.5),0,0.12,-1.05,0), placed(stoneBox(0.5,0.36,1.6),1.05,0.12,0,0), placed(stoneBox(0.5,0.36,1.6),-1.05,0.12,0,0)].map(q=>q.index?q.toNonIndexed():q), false), _stone);
  fr.receiveShadow=true; g.add(fr); const hole=new THREE.Mesh(new THREE.PlaneGeometry(1.6,1.6), new THREE.MeshBasicMaterial({ color:0x050403 })); hole.rotation.x=-Math.PI/2; hole.position.y=0.05; g.add(hole);
  const hinge=new THREE.Group(); hinge.position.set(0, 0.3, -0.8); g.add(hinge); const lid=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.12,1.7), _iron); lid.position.set(0,0,0.85); lid.castShadow=true; hinge.add(lid);
  return { x:wx, z:wz, hinge, open:0, want:0 }; }
function buildHatches(f){ f.hatches=[]; const n=f.tier+1+(MOBILE?0:1);
  for(let t=0;t<40 && f.hatches.length<n;t++){ const a=Math.random()*Math.PI*2, r=((f.Rin||f.R)-6)*(0.35+Math.random()*0.6), x=f.x+Math.cos(a)*r, z=f.z+Math.sin(a)*r;
    if(f.keepR && Math.hypot(x-f.x-f.keepX, z-f.z-f.keepZ)<f.keepR+3) continue; if(f.hatches.some(h=>Math.hypot(h.x-x,h.z-z)<9)) continue; if(blocks.some(b=>b.fortCover===f && Math.hypot(b.x-x,b.z-z)<3)) continue;
    f.hatches.push(makeHatch(f, x, z)); } }
function popHatch(h){ h.want=1; h.shutAt=performance.now()/1000+3.5; const gy=heightAt(h.x,h.z);
  burst({x:h.x, z:h.z}, 0x8a7a64, 8, 4, {y:gy+0.6, life:1.0, size:1.4, smoke:true, grav:-0.6, drag:1.8, up:2.4, op:0.5}); sfx('clang', {x:h.x, z:h.z}); }
function animHatches(f, dt, now){ for(const h of (f.hatches||[])){ if(h.want && now>h.shutAt) h.want=0; const k=h.want?6:2.2; h.open+=(h.want-h.open)*Math.min(1, dt*k); h.hinge.rotation.x=-h.open*1.95; } }
// a squad climbs out at (x,z): 3–5 riflemen, one or two with RPGs
function squadAt(f, x, z, n, inside){ const out=[]; for(let k=0;k<n;k++){ const a=Math.random()*6.283, r=0.6+Math.random()*2.2, type=(k===0 || (k===3 && S.stage>=3)) ? 'rpg' : 'rifle';
    const e=inside ? spawnAt(f, type, x+Math.cos(a)*r, z+Math.sin(a)*r) : spawnEnemy(type, x+Math.cos(a)*r, z+Math.sin(a)*r); if(!e) continue; e.fortOf=f; if(!inside) f.units.push(e); out.push(e); }
  if(!inside) makeSquad(out); return out; }   // Z173 a tunnel squad fights as one
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
function collapsePiece(f, pc, now){ const b=pc.block, i=blocks.indexOf(b); if(i<0) return; blocks.splice(i,1); pc.down=true; f.lastBreach=pc;
  _m.makeScale(0,0,0); f.wallIM.setMatrixAt(pc.i, _m); f.wallIM.instanceMatrix.needsUpdate=true; if(f.capIM){ f.capIM.setMatrixAt(pc.i, _m); f.capIM.instanceMatrix.needsUpdate=true; }
  const pos={x:b.x, z:b.z}; bigExplode(pos, 0xc8b49a, 1.6); for(let k=0;k<4;k++) spawnDebris(pos, 1.2, 0x8a8070);
  burst(pos, 0xb8a888, 10, 4, {y:f.gy+1.5, life:1.6, size:2.6, smoke:true, grav:-0.4, drag:1.6, up:1.8, op:0.55}); S.shake=Math.min(3, S.shake+1.1); sfx('bigexplode');
  for(const gd of (f.pt?f.pt.guards:[])){ if(gd.alive && gd.wx!=null && Math.hypot(gd.wx-b.x, gd.wz-b.z)<pc.pl*0.75) dropGuard(f.pt, gd, (gd.wx-f.x)/f.R, (gd.wz-f.z)/f.R); }   // the men on it come down with it
  rubble(f, pc);
  if(!f.breached) breachFort(f, now, true); }
// Z170 RUBBLE: a fallen section leaves its stone behind — broken slabs of masonry and concrete with rebar sticking out, strewn across the breach and spilling
//   both ways, on ground heaped up under them → the crossing is rough and the tank lurches over it
let _rubV=null;
function rubbleVariants(){ if(_rubV) return _rubV; _rubV=[]; for(let v=0;v<5;v++){ const g=new THREE.BoxGeometry(1,1,1,2,1,2), p=g.attributes.position, off=new Map();
    for(let i=0;i<p.count;i++){ const key=p.getX(i).toFixed(2)+','+p.getY(i).toFixed(2)+','+p.getZ(i).toFixed(2); if(!off.has(key)) off.set(key, [(Math.random()-0.5)*0.42, (Math.random()-0.5)*0.36, (Math.random()-0.5)*0.42]);   // chipped, uneven faces (shared corners stay joined)
      const o=off.get(key); p.setXYZ(i, p.getX(i)+o[0], p.getY(i)+o[1]*(p.getY(i)>0?1:0.3), p.getZ(i)+o[2]); }
    g.computeVertexNormals(); _rubV.push(g.index?g.toNonIndexed():g); } return _rubV; }
function heapGround(x, z, r, hgt){ const W=HF.W, h=HF.h, R=r*1.6, i0=Math.max(0,Math.floor((x-R+ARENA)/HF.step)), i1=Math.min(HF.N,Math.ceil((x+R+ARENA)/HF.step)), j0=Math.max(0,Math.floor((z-R+ARENA)/HF.step)), j1=Math.min(HF.N,Math.ceil((z+R+ARENA)/HF.step));
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const px=-ARENA+i*HF.step, pz=-ARENA+j*HF.step, q=Math.hypot(px-x,pz-z)/r; if(q<1.6) h[j*W+i]+=hgt*Math.exp(-q*q*1.6)*(0.8+Math.random()*0.4); }
  HF.dj0=Math.min(HF.dj0??1e9, j0-1); HF.dj1=Math.max(HF.dj1??-1, j1+1); HF.dirty=true; }
function rubble(f, pc){ const V=rubbleVariants(), nx=-pc.uz, nz=pc.ux, n=MOBILE?7:15, geos=[], bars=[];
  for(let k=0;k<4;k++){ const s=(k/3-0.5)*pc.pl*1.1, o=(Math.random()-0.35)*3.2; heapGround(f.x+pc.cx+pc.ux*s+nx*o, f.z+pc.cz+pc.uz*s+nz*o, 1.6+Math.random()*1.0, 0.45+Math.random()*0.45); }   // humps under the stone
  f.rubble=f.rubble||[]; f.rubble.push({ x:f.x+pc.cx, z:f.z+pc.cz, r:pc.pl*0.75+2.5 });
  for(let k=0;k<n;k++){ const s=(Math.random()-0.5)*(pc.pl+2.4), o=(Math.random()-0.4)*(k<4?1.6:6.4), lx=pc.cx+pc.ux*s+nx*o, lz=pc.cz+pc.uz*s+nz*o;   // the big slabs stay on the wall line, the smaller ones spill out
    const big=k<4, sx=big?1.6+Math.random()*1.3:0.5+Math.random()*0.8, sy=big?0.7+Math.random()*0.6:0.35+Math.random()*0.4, sz=big?1.1+Math.random()*0.9:0.45+Math.random()*0.7;
    const g=V[(Math.random()*V.length)|0].clone(); g.scale(sx, sy, sz); g.rotateX((Math.random()-0.5)*(big?0.9:1.6)); g.rotateZ((Math.random()-0.5)*(big?0.9:1.6)); g.rotateY(Math.random()*Math.PI);
    g.translate(lx, heightAt(f.x+lx, f.z+lz)-f.gy+sy*0.18, lz); geos.push(g);
    if(big) for(let q=0;q<3;q++){ const b=new THREE.CylinderGeometry(0.04,0.04,1.2+Math.random()*1.2,5); b.rotateZ(0.5+Math.random()*1.0); b.rotateY(Math.random()*6.28); b.translate(lx+(Math.random()-0.5)*sx*0.6, heightAt(f.x+lx, f.z+lz)-f.gy+sy*0.6, lz+(Math.random()-0.5)*sz*0.6); bars.push(b); } }   // twisted rebar
  const mt=(f.wallIM&&f.wallIM.material)||_stone, m=new THREE.Mesh(mergeGeometries(geos, false), mt); geos.forEach(g=>g.dispose()); m.castShadow=true; m.receiveShadow=true; f.g.add(m);
  if(bars.length){ const bm=new THREE.Mesh(mergeGeometries(bars.map(q=>q.index?q.toNonIndexed():q), false), _iron); bars.forEach(g=>g.dispose()); f.g.add(bm); } }
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
  showBanner((viaWall?'TƯỜNG ':'CỔNG ')+f.name+(viaWall?' ĐÃ SẬP':' ĐÃ VỠ')+' — XUNG PHONG!', '#ff8a3a'); radio(f.chief+': "Toàn quân! Địch đã vào thành! Xông lên, giết sạch chúng!"', 'f_rally_1');   // Z167 the commander's megaphone + his men's war cry
  wakeFort(f, now);
  for(const e of f.units) if(enemies.includes(e)) fortSendOut(f, e, now);                                     // the garrison pours out — through the gate / the breach, not through the stone
  if(f.tier===3 && !boss){ startBoss(now); if(boss){ boss.pos.set(f.x, 0, f.z); boss.mesh.position.set(f.x,0,f.z); boss.fort=f; } } }   // the citadel's commander IS the stage boss
// ================= Z111b WALLS, GATE, SORTIES =================
// --- line of fire: does the segment cross a standing wall section or the shut gate? (stone stops direct fire both ways) ---
function _segT(ax,az,bx,bz,cx,cz,dx,dz){ const rx=bx-ax, rz=bz-az, sx=dx-cx, sz=dz-cz, den=rx*sz-rz*sx; if(Math.abs(den)<1e-9) return -1;
  const qx=cx-ax, qz=cz-az, t=(qx*sz-qz*sx)/den, u=(qx*rz-qz*rx)/den; return (t>=0&&t<=1&&u>=0&&u<=1) ? t : -1; }
function _segDist(px,pz,ax,az,bx,bz){ const vx=bx-ax, vz=bz-az, L2=vx*vx+vz*vz||1, t=Math.max(0,Math.min(1,((px-ax)*vx+(pz-az)*vz)/L2)); return Math.hypot(ax+vx*t-px, az+vz*t-pz); }
export function fortWallCross(x1, z1, x2, z2){ let best=null, bt=2;
  for(const f of FORTS){ if(!f.g || !f.pieces) continue; if(_segDist(f.x,f.z,x1,z1,x2,z2) > f.R+2.5) continue;
    for(const pc of f.pieces){ if(pc.down) continue; const h=pc.pl/2+0.2, cx=f.x+pc.cx, cz=f.z+pc.cz;
      const t=_segT(x1,z1,x2,z2, cx-pc.ux*h, cz-pc.uz*h, cx+pc.ux*h, cz+pc.uz*h); if(t>=0 && t<bt){ bt=t; best=pc.block; } }
    if(f.gate && !f.breached && f.gateShut){ const h=FORT.gateW/2+0.3, t=_segT(x1,z1,x2,z2, f.gx-f.gux*h, f.gz-f.guz*h, f.gx+f.gux*h, f.gz+f.guz*h); if(t>=0 && t<bt){ bt=t; best=f.gate; } } }
  return best; }
// Z170 an UNBROKEN fortress is sealed: until a wall section falls or the gate is smashed nothing fired from outside gets in — not over the parapet, not through an open gateway.
//   returns the wall section / gate the path (x1,z1)→(x2,z2) strikes first, or null
export function fortIntactCross(x1, z1, x2, z2){ let best=null, bt=2;
  for(const f of FORTS){ if(f.breached || f.captured || !f.pieces || !f.gate) continue; if(_segDist(f.x,f.z,x1,z1,x2,z2) > f.R+2.5) continue;
    for(const pc of f.pieces){ if(pc.down) continue; const h=pc.pl/2+0.25, cx=f.x+pc.cx, cz=f.z+pc.cz, t=_segT(x1,z1,x2,z2, cx-pc.ux*h, cz-pc.uz*h, cx+pc.ux*h, cz+pc.uz*h); if(t>=0 && t<bt){ bt=t; best=pc.block; } }
    const h=FORT.gateW/2+0.4, t=_segT(x1,z1,x2,z2, f.gx-f.gux*h, f.gz-f.guz*h, f.gx+f.gux*h, f.gz+f.guz*h); if(t>=0 && t<bt){ bt=t; best=f.gate; } }
  return best; }
// Z170 does a light ray from the lamp (lx,ly,lz) to the ground at (hx,hy,hz) pass below the top of a standing wall / shut gate? (then the stone stops it)
export function fortBeamBlocked(lx, ly, lz, hx, hy, hz){
  for(const f of FORTS){ if(!f.pieces || _segDist(f.x,f.z,lx,lz,hx,hz) > f.R+2.5) continue; const top=f.gy+FORT.wallH+0.9;
    for(const pc of f.pieces){ if(pc.down) continue; const h=pc.pl/2+0.25, cx=f.x+pc.cx, cz=f.z+pc.cz, t=_segT(lx,lz,hx,hz, cx-pc.ux*h, cz-pc.uz*h, cx+pc.ux*h, cz+pc.uz*h); if(t>0.02 && t<0.98 && ly+(hy-ly)*t < top) return true; }
    if(f.gate && f.gateShut && !f.breached){ const h=FORT.gateW/2+0.3, t=_segT(lx,lz,hx,hz, f.gx-f.gux*h, f.gz-f.guz*h, f.gx+f.gux*h, f.gz+f.guz*h); if(t>0.02 && t<0.98 && ly+(hy-ly)*t < top) return true; } }
  return false; }
// a lobbed shell / rocket that came down on the walls of a sealed fort: it bursts on the stone
export function fortShellHit(bl, x, z, dmg, aoeR, wipe){ const f=bl.fort, y=(f?f.gy:0)+FORT.wallH;
  bigExplode(new THREE.Vector3(x, y, z), 0xffae5c, Math.max(0.8, (aoeR||4)/3.2)); burst({x,z}, 0xb8a888, 8, 5, {y, life:1.2, size:1.8, smoke:true, grav:-0.5, drag:1.6, up:1.5, op:0.5});
  for(let k=0;k<6;k++) spawnPart(x, y, z, (Math.random()-0.5)*9, 3+Math.random()*5, (Math.random()-0.5)*9, {color:0xa89a84, size:0.3+Math.random()*0.3, life:0.8, grav:-18, drag:1});
  damageBlock(bl, wipe ? bl.maxHp*0.6 : dmg); S.shake=Math.min(3, S.shake+0.4); sfx('bigexplode'); }
// --- the way out: form up inside the gate (or the nearest breach), then march out ---
function exitPts(f, e){ const G=FORT.gate; let pts=[[f.ix, f.iz],[f.ox, f.oz]];
  if(f.gateShut && !f.breached){ let bd=1e9; for(const pc of f.pieces){ if(!pc.down) continue; const cx=f.x+pc.cx, cz=f.z+pc.cz, d=Math.hypot(cx-e.pos.x, cz-e.pos.z); if(d<bd){ bd=d;
        const nx=(cx-f.x)/(Math.hypot(cx-f.x,cz-f.z)||1), nz=(cz-f.z)/(Math.hypot(cx-f.x,cz-f.z)||1); pts=[[cx-nx*G.inner, cz-nz*G.inner],[cx+nx*G.outer, cz+nz*G.outer]]; } } }
  return pts; }
export function fortSendOut(f, e, now){ if(!enemies.includes(e) || e.commander) return; e.guard=null; e.post=null; e.hold=null;   // Z170 the commander never leaves his fort
  const d=Math.hypot(e.pos.x-f.x, e.pos.z-f.z); if(d < f.R-0.5){ e.exit={ pts:exitPts(f, e), i:0, f, t0:now }; if(!f.breached) f.openUntil=Math.max(f.openUntil||0, now+FORT.gate.open); } }
const _ed={ x:0, z:0 };
// movement override while a unit is filing out (tactics.js / infantry.js call this before their own steering)
export function fortExitDir(e){ const q=e.exit; if(!q) return null;
  for(let k=0;k<3;k++){ const P=q.pts[q.i], dx=P[0]-e.pos.x, dz=P[1]-e.pos.z, L=Math.hypot(dx,dz);
    if(L>2.2){ _ed.x=dx/L; _ed.z=dz/L; return _ed; } q.i++; if(q.i>=q.pts.length){ e.exit=null; return null; } }
  return null; }
// a unit that was on its way out goes back to its post (the gate is shutting — we hold now)
function regarrison(f, e){ e.exit=null; const a=Math.random()*Math.PI*2, r=Math.random()*((f.Rin||f.R)-6); let x=f.x+Math.cos(a)*r, z=f.z+Math.sin(a)*r; if(f.keepR && Math.hypot(x-f.x-f.keepX, z-f.z-f.keepZ)<f.keepR+1.5){ x=2*f.x-x; z=2*f.z-z; }
  e.guard={ kind:'fort', x:f.x, z:f.z, r:f.R, fort:f }; e.post=[x,z]; e.hold={ x:f.x, z:f.z, r:f.R-3 }; }
// nobody stands in the gateway when it swings shut
function gateBusy(f){ const r2=(FORT.gateW*0.75)**2, p=S.player; if(p && (p.pos.x-f.gx)**2+(p.pos.z-f.gz)**2 < r2+9) return true;
  for(const e of enemies) if((e.pos.x-f.gx)**2+(e.pos.z-f.gz)**2 < r2) return true;
  for(const a of FT) if((a.pos.x-f.gx)**2+(a.pos.z-f.gz)**2 < r2) return true; return false; }
function updateGate(f, dt, now){ if(!f.leaves || f.breached) return;
  let want = now < (f.openUntil||0) ? 1 : 0; if(!want && f.gv>0.02 && gateBusy(f)) want=1;
  for(const e of enemies) if(e.exit && e.exit.f===f){ if(now-(e.exit.t0||now) > FORT.gate.exitMax){ if(Math.hypot(e.pos.x-f.x, e.pos.z-f.z) < f.R-1) regarrison(f, e); else e.exit=null; continue; } want=1; }   // hold it open while the column files out (a man stuck > exitMax goes back to his post)
  if(want && fortSealed(f)) want=0;
  f.gv = Math.max(0, Math.min(1, f.gv + (want?1:-1)*dt*FORT.gate.speed));
  for(const L of f.leaves){ L.g.rotation.y = L.s*f.gv*1.45; }
  const shut = f.gv < 0.2; if(shut!==f.gateShut){ f.gateShut=shut; const i=blocks.indexOf(f.gate);
    if(shut){ if(i<0) blocks.push(f.gate); sfx('clang'); } else if(i>=0) blocks.splice(i,1);
    if(!shut && Math.hypot(S.player.pos.x-f.x, S.player.pos.z-f.z) < f.R+70) floatText('CỔNG '+f.name+' MỞ', '#ff8a6a', new THREE.Vector3(f.gx, f.gy+FORT.wallH+5, f.gz), 15); } }
// --- posture: our strength near the walls vs the garrison → HOLD (shut the gate) or SALLY (open up and hit us) ---
function strength(f){ const P=FORT.posture, p=S.player, near=f.R+P.near; let ours=P.tank*Math.max(0.15, p.hp/p.maxHp)+riders.length*P.inf;
  for(const a of FT) if(Math.hypot(a.pos.x-f.x, a.pos.z-f.z) < near) ours+=P.inf;
  for(const t of ALLY_TANKS) if(Math.hypot(t.pos.x-f.x, t.pos.z-f.z) < near) ours+=P.allyTank;
  let theirs=0; for(const e of f.units) if(enemies.includes(e) && !e.exit && Math.hypot(e.pos.x-f.x, e.pos.z-f.z) < f.R) theirs += e.commander ? P.gTank*2 : (e.def.inf ? P.gInf : P.gTank);
  for(const e of (f.escort||[])) if(enemies.includes(e)) theirs+=P.gInf;
  return { ours, theirs }; }
function updatePosture(f, now){ if(now<f.postAt) return; f.postAt=now+0.5; const P=FORT.posture, p=S.player;
  const near = Math.hypot(p.pos.x-f.x, p.pos.z-f.z) < f.R+P.near; let want='idle';
  if(near && f.active && !f.breached && !fortSealed(f)){ const s=strength(f); want = s.ours >= s.theirs*P.holdK ? 'hold' : 'sally'; f.ratio=s; }
  if(want===f.posture) return; const was=f.posture; f.posture=want;
  if(want==='hold'){ for(const e of f.units) if(e.exit && e.exit.f===f && enemies.includes(e) && Math.hypot(e.pos.x-f.x, e.pos.z-f.z) < f.R-1) regarrison(f, e);
    f.openUntil=0; showBanner(f.name+' ĐÓNG CỔNG CỐ THỦ — PHÁ CỔNG ĐỂ VÀO!', '#ffb35a'); radio(f.chief+': "Anh em giữ thành! Bắn! Dồn hết hoả lực vào chiếc xe tăng đó!"', 'f_rally_2');
    if(!f.supplied){ f.supplied=true; const sd=POWERUPS.find(d=>d.id==='siege'); if(sd) setTimeout(()=>{ if(S.mode==='playing' && S.player){ dropPowerup({ x:S.player.pos.x+(Math.random()-0.5)*6, z:S.player.pos.z+(Math.random()-0.5)*6 }, 1, sd); radio('Hậu cần: thả ĐẠN PHÁ THÀNH cạnh xe — nhặt lấy rồi dồn vào cổng!'); } }, 2500); } }   // Z111b one siege crate per fortress that shuts its gate on you
  else if(want==='sally'){ f.sortieAt=now+1.2; showBanner(f.name+' MỞ CỔNG XUẤT QUÂN!', '#ff6a4a'); radio(f.chief+': "Không ai được lùi! Tất cả, tiến lên!"', 'f_rally_3'); }
  else if(was==='hold') f.sallyAt=Math.max(f.sallyAt, now+4); }
// SALLY posture: the garrison itself pours out in waves (the commander and his guard stay home)
function sortie(f, now){ if(now<(f.sortieAt||0)) return; const P=FORT.posture; f.sortieAt=now+R2(P.every);
  let nI=0, nT=0; for(const e of f.units){ if(!enemies.includes(e) || e.exit || e.commander || e.escortOf) continue; if(Math.hypot(e.pos.x-f.x, e.pos.z-f.z) > f.R-0.5) continue;
    if(e.def.inf ? nI<P.waveInf : nT<P.waveTank){ fortSendOut(f, e, now); if(e.def.inf) nI++; else nT++; } } }
// troops (pool, sallies, wave reinforcements) are raised INSIDE, by the gate: call after spawning them
export function fortLaunch(f, from, now){ now=now||performance.now()/1000; const lim=f.R-4;
  for(let i=from;i<enemies.length;i++){ const e=enemies[i]; const dx=e.pos.x-f.x, dz=e.pos.z-f.z, d=Math.hypot(dx,dz); if(d>lim){ e.pos.x=f.x+dx/d*lim; e.pos.z=f.z+dz/d*lim; if(e.mesh) e.mesh.position.set(e.pos.x, e.mesh.position.y, e.pos.z); }
    e.exit={ pts:exitPts(f, e), i:0, f, t0:now }; }
  if(!f.breached) f.openUntil=Math.max(f.openUntil||0, now+FORT.gate.open); }
// the fortress is ours and nobody is left inside → our men walk back out to the tank instead of standing in an empty yard
function checkCleared(f, now){ if(f.cleared) return; for(const e of f.units) if(enemies.includes(e) && Math.hypot(e.pos.x-f.x, e.pos.z-f.z) < f.R+3) return;
  for(const e of (f.escort||[])) if(enemies.includes(e)) return;
  f.cleared=true; const C=S.cmd, mine=C && C.kind==='assault' && C.f===f, inside=FT.filter(a=>Math.hypot(a.pos.x-f.x, a.pos.z-f.z) < f.R+6).length;
  if(mine || inside){ S.cmd={ kind:'muster', until:now+COMMAND.musterT }; for(const a of FT){ a.thinkAt=0; a.hold=null; }
    radio(f.name+' đã sạch bóng địch — toàn đội rút ra, tập kết về xe!'); floatText('RÚT QUÂN VỀ XE', '#9be04a', S.player.pos, 16); } }
// ---- garrison: comes alive when you close in (or the gate is hit) — refilled from the fortress pool ----
function spawnInside(f, type){ const a=Math.random()*Math.PI*2, r=Math.random()*((f.Rin||f.R)-4.5); let x=f.x+Math.cos(a)*r, z=f.z+Math.sin(a)*r; if(f.keepR && Math.hypot(x-f.x-f.keepX, z-f.z-f.keepZ)<f.keepR+1.5){ x=2*f.x-x; z=2*f.z-z; }   // Z145 never inside the donjon
  return spawnAt(f, type, x, z); }
function spawnAt(f, type, x, z){
  const e=spawnEnemy(type, x, z); if(!e) return null; e.fortOf=f; if(!f.breached){ e.guard={ kind:'fort', x:f.x, z:f.z, r:f.R, fort:f }; e.post=[x,z]; e.hold={ x:f.x, z:f.z, r:f.R-3 }; }
  f.units.push(e); return e; }
export function wakeFort(f, now){ if(f.active) return; f.active=true;
  if(f.tier!==3){ const c=spawnInside(f, FORT.cmdType); if(c){ c.hp=c.maxHp=Math.round(c.maxHp*FORT.cmdHp); if(FORT.cmdScale!==1){ c.mesh.scale.multiplyScalar(FORT.cmdScale); c.r*=FORT.cmdScale; } c.commander=f; c.loot=true; f.cmd=c; c.home={ x:f.x, z:f.z, r:(f.Rin||f.R)-5 };   // Z170 his ground: the yard, always
      f.escort=[]; const nE=RI(MOBILE?FORT.escortMobile:FORT.escort); for(let k=0;k<nE;k++){ const a=k/nE*Math.PI*2, r=R2(FORT.escortR), x=c.pos.x+Math.cos(a)*r, z=c.pos.z+Math.sin(a)*r;   // bodyguards ring the commander and go where he goes
        const e=spawnEnemy(k%3===2?'rpg':'rifle', x, z); if(!e) continue; e.fortOf=f; e.escortOf=c; e.escA=a; e.escR=r; e.guard={ kind:'escort', fort:f }; e.post=[x,z]; f.escort.push(e); }
      c.label=nameSprite(f.chief, '#ffd24a'); c.label.scale.set(10,1.9,1); c.label.position.set(0, 5.2/(c.mesh.scale.x||1), 0); c.label.scale.multiplyScalar(1/(c.mesh.scale.x||1)); c.mesh.add(c.label); } }
  showBanner(f.name+' BÁO ĐỘNG — '+f.chief+' TRẤN GIỮ', '#e0603a'); }
function refill(f){ const live=f.units.filter(e=>enemies.includes(e)); f.units=live; let nI=0, nT=0; for(const e of live){ if(e.def.inf) nI++; else nT++; }
  const capI=MOBILE?FORT.liveInfMobile:FORT.liveInf, capT=MOBILE?FORT.liveTanksMobile:FORT.liveTanks;
  if(nI<=capI-3 && f.pool.inf>0 && f.hatches && f.hatches.length){ const h=f.hatches[(Math.random()*f.hatches.length)|0], n=Math.min(f.pool.inf, 3+((Math.random()*3)|0)); popHatch(h); squadAt(f, h.x, h.z, n, true); f.pool.inf-=n; }   // Z170 a whole squad comes up from the basement
  else if(nI<capI && f.pool.inf>0 && !(f.hatches && f.hatches.length)){ spawnInside(f, Math.random()<0.25?'rpg':'rifle'); f.pool.inf--; }
  if(nT<capT && f.pool.tank>0){ spawnInside(f, ['grunt','gunner','shield','heavy'][Math.min(3, (Math.random()*(2+Math.min(2,S.stage/2)))|0)]); f.pool.tank--; } }
// the bodyguards keep their ring round the commander (posts move with him); he falls → they fight on their own
function escortFollow(f){ if(!f.escort) return; const c=f.cmd, alive=c && enemies.includes(c);
  for(let i=f.escort.length-1;i>=0;i--){ const e=f.escort[i]; if(!enemies.includes(e)){ f.escort.splice(i,1); continue; }
    if(!alive){ e.guard=null; e.post=null; continue; } e.escA+=0.06; e.post=[c.pos.x+Math.cos(e.escA)*e.escR, c.pos.z+Math.sin(e.escA)*e.escR]; } }
// sallies: a squad or a tank marches out of the gate onto the field
function sally(f, now){ f.sallyAt=now+R2(FORT.sally)*(f.tier===3?0.8:1);
  const p=S.player; if(!p || f.posture==='hold' || fortSealed(f)) return;                     // Z111b a fortress that holds keeps its gate shut
  let n=0; for(const e of enemies) if(!e.guard) n++; if(n > (MOBILE?16:26)) return;   // the field is already crowded
  const n0=enemies.length;
  if(Math.random()<FORT.sallyTank && f.pool.tank>0){ const e=spawnEnemy(['grunt','scout','gunner','shield'][(Math.random()*4)|0], f.ix, f.iz); if(e) f.pool.tank--; }
  else if(f.pool.inf>=3){ spawnSquad({ x:f.ix, z:f.iz }); f.pool.inf-=3; } else return;
  for(let i=n0;i<enemies.length;i++) enemies[i].fortOf=f;   // Z107 sally troops belong to their fortress (they don't hold a wave open)
  fortLaunch(f, n0, now); }                                  // Z111b formed up INSIDE the gate → it swings open → they march out
// wave reinforcements come out of a fortress gate (most of the time) instead of over the fence — raised inside, then the gate opens
export function fortSpawnPoint(){ const alive=FORTS.filter(f=>!f.captured && f.g && f.posture!=='hold' && !fortSealed(f)); if(!alive.length || Math.random()>FORT.fromGate) return null;
  const p=S.player; alive.sort((a,b)=>Math.hypot(a.ox-p.pos.x,a.oz-p.pos.z)-Math.hypot(b.ox-p.pos.x,b.oz-p.pos.z)); const f=alive[Math.random()<0.6?0:(Math.random()*alive.length)|0];
  return { x:f.ix+(Math.random()-0.5)*3, z:f.iz+(Math.random()-0.5)*3, fort:f }; }
// Z140 the enemy pole topples (1.4 s), then our flag rises up a fresh pole
function animFlag(f, dt){ const F=f.flagFall, G=f.flagG; F.t+=dt;
  if(F.t<1.4){ const k=Math.min(1, F.t/1.4), e=k*k; G.rotation.set(Math.sin(F.dir)*e*1.45, 0, Math.cos(F.dir)*e*1.45); if(k>=0.99){ S.shake=Math.max(S.shake,0.6); burst({x:f.x+Math.cos(F.dir)*f.flagH*0.7, z:f.z-Math.sin(F.dir)*f.flagH*0.7}, 0x8a7a60, 6, 5, { y:0.5, life:1.2, size:1.8, smoke:true, grav:-0.3, drag:1.6, up:1.2, op:0.5 }); sfx('clang'); } return; }
  if(!F.ours){ F.ours=true; unwave(f.flag); f.g.remove(G); const ng=new THREE.Group(); ng.position.copy(G.position); f.g.add(ng); f.flagG=ng;
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.16,f.flagH,8), _iron); pole.position.y=f.flagH/2; ng.add(pole);
    const fl=makeFlag(vnTex(), 4.4, 2.8, 1); fl.position.set(0, f.flagH-1.8, 0); ng.add(fl); f.flag=fl; ng.scale.set(1,0.01,1); }
  const u=Math.min(1,(F.t-1.6)/1.6); if(u>0) f.flagG.scale.y=Math.max(0.01,u); if(u>=1) f.flagFall=null; }
// ---- capture: the commander is dead → the fortress is ours, its treasury opens ----
function capture(f, now){ if(f.captured) return; f.captured=true; f.active=false;
  if(f.flagG){ f.flagFall={ t:0, dir:Math.random()*6.28 }; } else { unwave(f.flag); f.g.remove(f.flag); const fl=makeFlag(rallyFlagTex(), 3.2, 2.0, 1); fl.position.set(0, 8.2, 0); f.g.add(fl); f.flag=fl; }   // Z140 the enemy colours come crashing down
  if(f.label){ f.label.material.opacity=0.45; }
  for(const e of f.units) if(enemies.includes(e)) fortSendOut(f, e, now);
  if(f.bar){ freeEnemyBar(f.bar); f.bar=null; } if(!f.breached){ f.breached=true; const i=blocks.indexOf(f.gate); if(i>=0) blocks.splice(i,1); for(const L of f.leaves) L.open=0.001; }
  const L=FORT.loot, coins=Math.round((L.coins[0]+L.coins[1]*S.stage)*f.tier*loopRewardMul()), dia=L.dia[0]+((Math.random()*(L.dia[1]-L.dia[0]+1))|0)+(f.tier>=2?1:0);
  addCoins(coins); addDiamonds(dia); refreshWallet();
  for(let k=0;k<L.drops+f.tier-1;k++) dropPowerup({ x:f.x+(Math.random()-0.5)*8, z:f.z+(Math.random()-0.5)*8 }, Math.min(3, f.tier));
  for(let k=0;k<GUN_MODS.fortDrops;k++) dropPowerup({ x:f.x+(Math.random()-0.5)*6, z:f.z+(Math.random()-0.5)*6 }, 2, modDrop());   // Z115 the armoury: a gun part
  let gunTx=''; if(Math.random()<L.gunChance*f.tier){ const not=Object.keys(GUNS).filter(id=>!PROFILE.ownedGuns.includes(id) && GUNS[id].tier && GUNS[id].tier<=1+f.tier); if(not.length){ const id=not[(Math.random()*not.length)|0]; ownGun(id); gunTx=' · SÚNG MỚI: '+GUNS[id].name; } }
  saveProfile();
  bigExplode({x:f.x,z:f.z}, 0x9be04a, 1.6); ringPulse(new THREE.Vector3(f.x,0,f.z), 0x9be04a, 6); sfx('levelup'); celebrate('fort', f.x, f.z);   // Z140 fireworks over the taken fort
  showBanner('ĐÃ CHIẾM '+f.name+'!  +'+coins+' xu · +'+dia+' ◆'+gunTx, '#8cbf3f');
  const left=fortsLeft(); radio(left ? ('Còn '+left+' đại bản doanh. '+(left===1 && mainFort() && !mainFort().captured ? 'Cổng '+mainFort().name+' đã mở phong toả!' : 'Tiếp tục tiến công!')) : 'Mọi đại bản doanh đã thất thủ!'); }
// the citadel falls with its commander — the stage boss (boss.js kills → stage clear)
export function fortBossDown(){ const f=mainFort(); if(f && !f.captured) capture(f, performance.now()/1000); }
// ---- per frame ----
export function updateForts(dt, now){ const p=S.player; if(!p) return; if(((now*4)|0)!==_fhT){ _fhT=(now*4)|0; updateFortHud(); }
  for(const f of FORTS){ if(!f.g) continue;
    if(f.leaves){ for(const L of f.leaves){ if(L.open){ L.open=Math.min(1, L.open+dt*1.8); L.g.rotation.y = L.s*L.open*1.45; L.g.rotation.z = L.s*L.open*0.08; } } }
    updateGate(f, dt, now);
    if(f.hitT>0){ f.hitT-=dt; f.gate && (f.gate.mesh.position.x += (Math.random()-0.5)*0.04); }
    if(f.bar && f.gate){ const k=Math.max(0, f.gate.hp/f.gate.maxHp); f.bar.g.position.set(f.gx, f.gy+FORT.wallH+3.6, f.gz); f.bar.g.quaternion.copy(camera.quaternion); f.bar.fill.scale.x=Math.max(0.001,k); f.bar.fill.position.x=-(1-k)*0.5; f.bar.fill.material.color.setHex(fortSealed(f)?0x7fa8ff:(k>0.5?0xffcf5a:0xff6a4a)); }
    if(f.rubble && p.vel){ const sp=Math.hypot(p.vel.x, p.vel.z); if(sp>2.5) for(const q of f.rubble) if((p.pos.x-q.x)**2+(p.pos.z-q.z)**2 < q.r*q.r){ S.shake=Math.max(S.shake, 0.1+Math.min(0.3, sp*0.02)); if(Math.random()<dt*4) haptic(12); break; } }   // Z170 grinding over the rubble
    if(f.hatches) animHatches(f, dt, now);
    if(f.flagFall) animFlag(f, dt);
    if(f.captured){ checkCleared(f, now); continue; }
    if(boss && boss.alive && boss.fort===f){ const lim=(f.Rin||f.R)-6, dx=boss.pos.x-f.x, dz=boss.pos.z-f.z, q=Math.hypot(dx,dz); if(q>lim){ boss.pos.x=f.x+dx/q*lim; boss.pos.z=f.z+dz/q*lim; if(boss.mesh){ boss.mesh.position.x=boss.pos.x; boss.mesh.position.z=boss.pos.z; } } }   // Z170 the citadel's general fights from inside his walls
    const d=Math.hypot(p.pos.x-f.x, p.pos.z-f.z);
    if(!f.active && d<FORT.wakeR+f.R) wakeFort(f, now);
    if(f.active){ if(((now*4)|0)!==f._rt){ f._rt=(now*4)|0; if(!f.leaderless) refill(f); else f.units=f.units.filter(e=>enemies.includes(e)); escortFollow(f); }
      for(const e of f.units){ const H=e.home||e.hold; if(!H || e.def.inf) continue; const dx=e.pos.x-H.x, dz=e.pos.z-H.z, q=Math.hypot(dx,dz); if(q>H.r){ e.pos.x=H.x+dx/q*H.r; e.pos.z=H.z+dz/q*H.r; e.vel.multiplyScalar(0.2); } }   // tanks stay behind the walls until the gate falls
      updatePosture(f, now); if(f.posture==='sally' && !f.leaderless) sortie(f, now);
      if(f.cmd && !enemies.includes(f.cmd) && !f.leaderless){ f.leaderless=true; showBanner('TƯỚNG '+f.name+' ĐÃ CHẾT — DIỆT NỐT QUÂN TRONG THÀNH!', '#ffcf5a'); radio('SCH: Tướng giữ '+f.name+' đã bị hạ. Quét sạch quân còn lại — thành sẽ không còn được tiếp viện!'); }   // Z140 commander down → no more reinforcements
      if(f.leaderless && !f.units.some(e=>enemies.includes(e) && Math.hypot(e.pos.x-f.x, e.pos.z-f.z) < f.R+1)){ if(f.tunnel>0) tunnelAmbush(f, now); else if(now>(f.tunnelWait||0)) capture(f, now); } }   // … and the last defender inside is gone (Z170 and the tunnels have emptied) → the fort falls
    if(now>f.sallyAt && !f.leaderless) sally(f, now);
  }
}
// Z170 TUNNEL AMBUSH: the yard looks clear — then, a beat later, squads burst out of the tunnels: one from a hatch in the yard, one from a hidden exit near the tank
function tunnelAmbush(f, now){ if(!f.tunnelAt){ f.tunnelAt=now+1.6+Math.random()*2.4; return; } if(now<f.tunnelAt) return;
  f.tunnel--; f.tunnelAt=0; f.tunnelWait=now+2; const p=S.player, nS=2+((Math.random()*2)|0);
  if(f.hatches && f.hatches.length){ const h=f.hatches[(Math.random()*f.hatches.length)|0]; popHatch(h); squadAt(f, h.x, h.z, nS+1, true); }
  if(p){ for(let t=0;t<24;t++){ const a=(p.facing||0)+Math.PI+(Math.random()-0.5)*2.4, d=12+Math.random()*10, x=p.pos.x+Math.sin(a)*d, z=p.pos.z+Math.cos(a)*d;   // behind or beside the tank
      if(!inField(x, z, 3) || FORTS.some(o=>Math.hypot(o.x-x,o.z-z)<o.R+2) || blocks.some(b=>Math.hypot(b.x-x,b.z-z)<b.r+2)) continue;
      const h=makeHatch(f, x, z); f.hatches.push(h); popHatch(h); bigExplode(new THREE.Vector3(x, heightAt(x,z)+0.5, z), 0x8a7a64, 0.7); squadAt(f, x, z, nS, false); break; } }
  showBanner('ĐỊCH CHUI LÊN TỪ ĐƯỜNG HẦM!', '#ff6a4a'); radio('SCH: Phục kích từ đường hầm dưới '+f.name+'! Quay nòng lại!'); }
// HUD: one line per fortress — name · gate % / sealed / garrison stirred / ours (written only when it changes)
let _fh='';
export function updateFortHud(){ const el=document.getElementById('fortHud'); if(!el) return; if(!FORTS.length){ if(_fh){ _fh=''; el.classList.add('hidden'); } return; }
  const rows=FORTS.map(f=>{ const st=f.captured?'<em class="ok">✓ ĐÃ CHIẾM</em>':fortSealed(f)?'<em class="sl">🔒 PHONG TOẢ</em>':f.breached?'<em class="br">THỦNG THÀNH · '+(f.cmd?'DIỆT TƯỚNG':'TƯỚNG')+'</em>':'<em>CỔNG '+Math.ceil(100*Math.max(0,f.gate.hp)/f.gate.maxHp)+'%</em>';
    return '<div class="fh-r'+(f.captured?' done':'')+(f.tier===3?' main':'')+'"><b>'+f.name+'</b>'+st+'</div>'; }).join('');
  const html='<div class="fh-t">ĐẠI BẢN DOANH · '+(FORTS.length-fortsLeft())+'/'+FORTS.length+'</div>'+rows;
  if(html!==_fh){ _fh=html; el.innerHTML=html; el.classList.remove('hidden'); } }
export function clearForts(){ { const el=document.getElementById('fortHud'); if(el){ el.classList.add('hidden'); _fh=''; } } for(const f of FORTS){ if(f.g){ unwave(f.g); scene.remove(f.g); } if(f.bar){ freeEnemyBar(f.bar); f.bar=null; } } FORTS.length=0;
  for(let i=blocks.length-1;i>=0;i--) if(blocks[i].kind==='fortwall'||blocks[i].kind==='gate') blocks.splice(i,1); }
