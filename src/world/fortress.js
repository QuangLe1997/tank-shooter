// world/fortress.js — Z107 FORTRESSES (đại bản doanh): 3–4 named strongholds a stage — crenellated walls with riflemen on top, corner watchtowers, one heavy gate to batter open, a crowded garrison + a commander inside; troops sally from the gates. Take them all to win the stage (the main citadel's gate opens last and its commander is the boss).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FORT, FORT_CMD, COMMAND, HOME_GAP, HUMAN_SCALE, REALFORT, FORT_GAP, BREAKUP, SCENERY } from '../../config.js';
import { ARENA, BIOME, BIOME_PLACE, COVER_HP, FT, HF, MOBILE, S, UNDER, ZONES, bigExplode, biomePlace, blocks, buildTower, burst, camera, campFlagTex, capGeo, capMat, celebrate, coverMat, damageBlock, detailize, diffHpMul, dropGuard, dropPowerup, enemies, fieldR, flameFX, flashMat, floatText, fortStyle, freeEnemyBar, getEnemyBar, haptic, heightAt, homeClear, inField, loopHpMul, makeCoverMesh, makeFlag, makeSoldierMesh, makeSquad, propTex, radio, rallyFlagTex, ringPulse, saveProfile, scene, sfx, showBanner, spawnDebris, spawnEnemy, spawnPart, spawnSquad, startBoss, towerRoof, towers, unwave, vnTex, wallMat, loadGLTF, buildOutpost, farLOD, landTone, sceneDims, scenePiece, decalAsh, breakScar, decalScorch, hillCfg, paveYard, raiseFortHills, raiseWard } from '../hub.js';

export const FORTS=[];
const R2=(r)=>r[0]+Math.random()*(r[1]-r[0]), RI=(r)=>Math.round(R2(r));
export function fortsLeft(){ let n=0; for(const f of FORTS) if(!f.captured) n++; return n; }
export function mainFort(){ return FORTS.find(f=>f.tier===3); }
let _nameI=0, _fhT=0;

// ---- plan: reserve ground first (called at the top of planZones) — far side + flanks, the biggest one farthest from our spawn ----
export function planForts(){ clearForts(); const st=Math.min(4, Math.max(0, S.stage-1)), n=(MOBILE?FORT.countMobile:FORT.count)[st];
  const cand=[], NM=(BIOME_PLACE[BIOME.name]||{}).forts||FORT.names; _nameI=(Math.random()*NM.length)|0;   // Z170 real place names of this land
  for(let t=0;t<600 && cand.length<n;t++){ const tier = cand.length===0 ? 3 : (cand.length===1 && n>=4 ? 2 : (Math.random()<0.35?2:1)), T=FORT.tiers[tier], late=t>=220, R=Math.max(FORT.minR, (late?T.r[0]:R2(T.r))*(MOBILE?FORT.mobileR:1));   // Z234 phones: the small field takes smaller forts (so they stand clear of our citadel)
    const a=-Math.PI/2+(Math.random()-0.5)*Math.PI*(cand.length===0?(late?1.1:0.7):1.55), FR=fieldR(a), fr=cand.length===0?0.6+Math.random()*0.15:0.45+Math.random()*0.35, hk=t<220?1:t<380?0.85:HOME_GAP.minK;
    const dMin=HOME_GAP.wall+R+(MOBILE?HOME_GAP.gapMobile:HOME_GAP.gap)*hk+1, dMax=FR-R-9; if(dMax<dMin) continue;   // Z234 between our home ground and the fence (big forts keep the whole ring inside it)
    const d=late ? dMin+Math.random()*(dMax-dMin) : Math.max(dMin, Math.min(FR*fr, dMax));   // a crowded / watery field: try the whole band, not only the preferred depth
    const x=Math.cos(a)*d, z=Math.sin(a)*d;
    if(!inField(x, z, R+7) || !homeClear(x, z, R, false, hk) || Math.hypot(x, z-ARENA*0.55)<R+40) continue;
    if(cand.some(c=>Math.hypot(c.x-x, c.z-z) < c.R+R+34)) continue;   // Z144 wide gaps between strongholds
    cand.push({ x, z, R, tier }); }
  for(const c of cand){ const f={ ...c, name:FORT.tiers[c.tier].name+' '+NM[(_nameI++)%NM.length], chief:'TƯỚNG '+FORT.chiefs[(Math.random()*FORT.chiefs.length)|0],
      captured:false, breached:false, active:false, units:[], cmd:null, sallyAt:0, g:null };
    FORTS.push(f); ZONES.push({ kind:'fort', x:f.x, z:f.z, r:f.R+7, fort:f }); }
  raiseFortHills(FORTS);   // Z453 on the limestone, each on a crag (world/fort-hill.js)
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
// Z241 battered (sloped) block: a box whose top face is pulled in to dTop deep — talus at the foot of a wall / tower
function taperBox(w, h, dBot, dTop, wTop){ const g=stoneBox(w, h, dBot), p=g.attributes.position, kz=dTop/dBot, kx=(wTop||w)/w;
  for(let i=0;i<p.count;i++) if(p.getY(i)>0){ p.setZ(i, p.getZ(i)*kz); p.setX(i, p.getX(i)*kx); } g.computeVertexNormals(); return g; }
let _pieceGeo=null, _pieceDark=null;   // one 3 m wall section (stone · dark recesses), scaled along x per instance
// Z241 A GREAT CURTAIN WALL SECTION (11 m): local −z is the outer face. Battered talus at the foot, a moulded plinth, two string courses,
//   a buttress pilaster per section, a machicolation gallery corbelled out from the top carrying a breastwork with coped merlons, a low
//   parapet on the inner edge of the wall-walk; arrow loops, gun ports and the murder-holes between the corbels are the dark recesses
function pieceGeo(){ if(_pieceGeo) return _pieceGeo; const H=FORT.wallH, TH=FORT.wallT, L=FORT.seg, ox=-(TH/2), parts=[];
  parts.push(placed(stoneBox(L, H+2, TH), 0, H/2-1, 0, 0));                                                   // the curtain
  parts.push(placed(taperBox(L, 3.6, TH+3.0, TH+0.2), 0, 0.8, 0, 0));                                          // battered talus
  parts.push(placed(stoneBox(L, 0.36, TH+0.5), 0, 2.72, 0, 0));                                                // plinth moulding on the talus
  for(const y of [H*0.42, H*0.7]) parts.push(placed(stoneBox(L, 0.24, TH+0.24), 0, y, 0, 0));                  // string courses
  parts.push(placed(taperBox(0.95, H-3.4, 0.8, 0.55, 0.8), 0, 2.9+(H-3.4)/2, ox-0.35, 0));                      // buttress pilaster on the outer face
  for(const k of [-1,0,1]){ parts.push(placed(stoneBox(0.42, 0.55, 1.1), k*1.0, H-1.55, ox-0.48, 0), placed(stoneBox(0.42, 0.55, 0.8), k*1.0, H-1.0, ox-0.62, 0)); }   // stepped corbels
  parts.push(placed(stoneBox(L, 1.1, 0.75), 0, H+0.35, ox-0.55, 0));                                           // breastwork on the gallery
  parts.push(placed(stoneBox(L, 0.2, 0.95), 0, H-0.28, ox-0.5, 0));                                             // gallery floor edge
  for(const sx of [-0.78, 0.78]){ parts.push(placed(stoneBox(0.98, 1.45, 0.75), sx, H+1.62, ox-0.55, 0), placed(stoneBox(1.12, 0.14, 0.9), sx, H+2.41, ox-0.55, 0)); }   // merlons + coping
  parts.push(placed(stoneBox(L, 0.75, 0.42), 0, H+0.38, TH/2-0.2, 0), placed(stoneBox(L, 0.12, 0.55), 0, H+0.8, TH/2-0.2, 0));   // inner parapet of the wall-walk
  _pieceGeo=mergeGeometries(parts.map(q=>q.index?q.toNonIndexed():q), false); parts.forEach(q=>q.dispose()); return _pieceGeo; }
function pieceDarkGeo(){ if(_pieceDark) return _pieceDark; const H=FORT.wallH, TH=FORT.wallT, L=FORT.seg, ox=-(TH/2), parts=[];
  for(const sx of [-0.95, 0.95]){ parts.push(placed(new THREE.BoxGeometry(0.2, 1.6, 0.14), sx, H*0.56, ox-0.02, 0), placed(new THREE.BoxGeometry(0.7, 0.16, 0.14), sx, H*0.56, ox-0.02, 0)); }   // cross-shaped arrow loops
  parts.push(placed(new THREE.BoxGeometry(0.62, 0.42, 0.14), 0, 4.4, ox-0.72, 0));                              // gun port through the pilaster
  for(const sx of [-0.5, 0.5]) parts.push(placed(new THREE.BoxGeometry(0.52, 0.06, 0.42), sx, H-0.39, ox-0.6, 0));   // murder-holes under the gallery
  parts.push(placed(new THREE.BoxGeometry(0.42, 0.7, 0.1), 0, H+1.15, ox-0.94, 0));                              // the crenel's sighting slot
  _pieceDark=mergeGeometries(parts.map(q=>q.index?q.toNonIndexed():q), false); parts.forEach(q=>q.dispose()); return _pieceDark; }

// ---- raise every planned fortress (called from buildZones, after the watchtowers) ----
export function buildForts(){ mats(); let fi=Math.floor(Math.random()*6);   // Z140 the walls are built the way this land builds them — and no two forts alike
  { const LK=realFort() && REALFORT.looks && REALFORT.looks[BIOME.name], rest=LK ? LK.slice(1).sort(()=>Math.random()-0.5) : []; let k=0; for(const f of FORTS){ const L=LK ? (f.tier===3 ? LK[0] : rest[k++ % rest.length]) : null; f.look=L ? { ...((REALFORT.keepFit||{})[L.keep]), ...L } : null; } }   // Z457 every fort its own look: stone, architecture, the castle in its yard (the capital the first)
  for(const f of FORTS){ const ST=fortStyle(BIOME.name, fi++), WM=wallMat(ST); f.style=ST; const T=FORT.tiers[f.tier], gy=flattenFort(f.x, f.z, f.R); f.gy=gy;
    const g=new THREE.Group(); g.position.set(f.x, gy, f.z); scene.add(g); f.g=g;
    const sides=T.sides[(Math.random()*T.sides.length)|0], rot=Math.random()*Math.PI, H=FORT.wallH, TH=FORT.wallT;
    const ga=Math.atan2(ARENA*0.55-f.z, -f.x);                          // the gate faces our side of the field
    // Z145 a real fort follows its ground, not a compass: an IRREGULAR outline — every corner at its own angle and distance (never a neat hexagon) —
    //   re-rolled until the gate wall is long enough for the gatehouse
    let V=[]; for(let tries=0;tries<12;tries++){ V=[]; for(let i=0;i<sides;i++){ const a=rot+(i+(Math.random()-0.5)*0.5)/sides*Math.PI*2, rr=f.R*(0.88+Math.random()*0.18); V.push([Math.cos(a)*rr, Math.sin(a)*rr]); }
      let ok=true; for(let i=0;i<sides;i++){ const [x0,z0]=V[i], [x1,z1]=V[(i+1)%sides]; if(Math.hypot(x1-x0,z1-z0) < FORT.gateW+12) ok=false; } if(ok) break; }
    f.Rin=Math.min(...V.map((v,i)=>{ const w=V[(i+1)%sides], L=Math.hypot(w[0]-v[0],w[1]-v[1]); return Math.abs(v[0]*w[1]-v[1]*w[0])/L; }));   // nearest wall to the centre
    if(f.tier===3 && hillCfg() && hillCfg().open) raiseWard(f);   // Z453 the capital's keep on a raised ward, a ramp down toward the gate
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
    const FLAGS=[];
    const keep=(px,pz,ry,ox,oz,TW,TH2,nm=3)=>{ (f.kp||(f.kp=[])).push([px,pz,ry,TW,TH2]); geos.push(placed(stoneBox(TW, TH2+1, TW), px, (TH2-1)/2, pz, ry), placed(taperBox(TW+3.2, 4.2, TW+3.2, TW+0.3, TW+0.3), px, 1.0, pz, ry), placed(stoneBox(TW+0.6, 0.4, TW+0.6), px, 3.2, pz, ry));   // Z241 battered talus + plinth moulding
      for(const y of [H*0.42, H*0.72, H+2.4, ...(TH2-H>9?[H+(TH2-H)*0.55]:[])]) geos.push(placed(stoneBox(TW+0.24, 0.26, TW+0.24), px, y, pz, ry));   // string courses up the shaft
      { const c=Math.cos(-ry), s2=Math.sin(-ry); for(const a of [-1,1]) for(const b of [-1,1]){ const lx=a*(TW/2+0.12), lz=b*(TW/2+0.12); geos.push(placed(stoneBox(0.62, TH2-5.2, 0.62), px+c*lx-s2*lz, 3.4+(TH2-5.2)/2, pz+s2*lx+c*lz, ry)); } }   // Z241 corner pilasters
      geos.push(placed(stoneBox(TW+0.9, 0.6, TW+0.9), px, TH2-0.9, pz, ry));
      const tx=Math.cos(-ry), tz=Math.sin(-ry), at=(l,o)=>[px+tx*l+ox*o, pz+tz*l+oz*o];
      for(const [lx,lz] of [[1,0],[-1,0],[0,1],[0,-1]]) for(const t of (nm>4?[-0.42,-0.3,-0.18,-0.06,0.06,0.18,0.3,0.42]:[-0.36,-0.12,0.12,0.36])){ const [cx,cz]=at(lx?lx*(TW/2+0.16):t*TW*1.3, lz?lz*(TW/2+0.16):t*TW*1.3); geos.push(placed(stoneBox(0.3,0.6,0.3), cx, TH2-1.5, cz, ry)); }
      const E=(TW+0.9)/2-0.2; for(const [lx,lz] of [[1,0],[-1,0],[0,1],[0,-1]]) for(let q=0;q<nm;q++){ const t=nm>1?-1+2*q/(nm-1):0, [cx,cz]=at(lx?lx*E:t*E*0.8, lz?lz*E:t*E*0.8); geos.push(placed(stoneBox(0.62,0.95,0.62), cx, TH2-0.12, cz, ry)); }
      for(const y of [H*0.35, H*0.62, H+1.3, ...(TH2-H>9?[H+(TH2-H)*0.45]:[]), TH2-2.9]) for(const l of (nm>3?[-TW*0.28,0,TW*0.28]:[0])) for(const [a1,a2] of (nm>3?[[0,1],[0,-1],[1,0],[-1,0]]:[[0,1],[0,-1]])){ const [sx,sz]=at(a1?a1*(TW/2+0.03):l, a2?a2*(TW/2+0.03):l); slit(sx, y, sz, a1?ry+Math.PI/2:ry); }
      const rf=new THREE.Mesh(towerRoof(ST, TW-0.2, TH2+0.4), capMat); rf.position.set(px,0,pz); rf.rotation.y=ry; rf.castShadow=true; g.add(rf); if(TW<10) FLAGS.push([px,pz,TH2]); };   // Z176 every great tower flies the garrison's colours
    V.forEach(([vx,vz],vi)=>{ const L=Math.hypot(vx,vz), ox=vx/L, oz=vz/L, ry=-Math.atan2(-ox,oz), tall = vi%2===0 || sides<=6 && vi%3===1;   // Z145 every other corner is a TALL tower
      if(!ST.round) keep(vx, vz, ry, ox, oz, tall?FORT.arch.tallW:FORT.arch.bastW, H+(tall?FORT.arch.tall:FORT.arch.bastH), tall?5:4);   // Z241 great corner towers · squat bastions between them
      else { const hh=tall?H+FORT.arch.tall:H+FORT.arch.bastH, rr=tall?FORT.arch.tallW*0.62:FORT.arch.bastW*0.56, dr=cylUV(new THREE.CylinderGeometry(rr, rr+0.3, hh, 28), 14, hh); dr.translate(vx, hh/2-1, vz); geos.push(dr);   // Z140 round drum towers on alternate forts
        for(const [r0,r1,h2,yy] of [[rr+0.3,rr+1.6,4.2,1.0],[rr+0.3,rr+0.3,0.4,3.2],[rr+0.25,rr+0.3,0.26,H*0.42],[rr+0.25,rr+0.3,0.26,H*0.72],[rr+0.25,rr+0.3,0.26,H+2.4],[rr+0.55,rr+0.25,0.7,hh-2.0]]){ const ring=cylUV(new THREE.CylinderGeometry(r0,r1,h2,28), 14, h2); ring.translate(vx,yy,vz); geos.push(ring); }   // plinth · string course · corbel ring
        { const nM=Math.round(rr*4.4); for(let k=0;k<nM;k++){ const a=k/nM*6.283; geos.push(placed(stoneBox(0.62,1.05,0.55), vx+Math.cos(a)*(rr+0.3), hh-0.55, vz+Math.sin(a)*(rr+0.3), -a)); } }   // merlon ring
        for(const y of tall?[H*0.36,H*0.66,H+2.2,H+5.4,hh-3.6]:[H*0.4,H*0.72]) for(const da of [-0.5,0,0.5]){ const sa=Math.atan2(oz,ox)+da; slit(vx+Math.cos(sa)*(rr+0.32), y, vz+Math.sin(sa)*(rr+0.32), -sa+Math.PI/2); }
        const rf=new THREE.Mesh(towerRoof(ST, rr*1.8, hh-0.6), capMat); rf.position.set(vx,0,vz); rf.castShadow=true; g.add(rf); if(tall) FLAGS.push([vx,vz,hh-0.6]); } });
    // Z241 FLANKING TOWERS: every long curtain gets a tower standing proud of its outer face at mid-span (solid stone: a collider of its own)
    for(let i=0;i<sides;i++){ if(i===gi) continue; const [x0,z0]=V[i], [x1,z1]=V[(i+1)%sides], L=Math.hypot(x1-x0,z1-z0); if(L<FORT.arch.flankMin) continue;
      const ux=(x1-x0)/L, uz=(z1-z0)/L, ry=-Math.atan2(z1-z0,x1-x0), mx=(x0+x1)/2, mz=(z0+z1)/2, sg=Math.sign(-uz*mx+ux*mz)||1, onx=-uz*sg, onz=ux*sg, FW=FORT.arch.flankW, off=TH/2+FW/2-0.8, cx=mx+onx*off, cz=mz+onz*off, hh=H+FORT.arch.flankH;
      if(ST.round){ (f.kp||(f.kp=[])).push([cx,cz,ry,FW*1.1,hh]); const rr=FW*0.55, dr=cylUV(new THREE.CylinderGeometry(rr, rr+0.3, hh, 28), 14, hh); dr.translate(cx, hh/2-1, cz); geos.push(dr);
        for(const [r0,r1,h2,yy] of [[rr+0.3,rr+1.5,4.2,1.0],[rr+0.25,rr+0.3,0.26,H*0.5],[rr+0.25,rr+0.3,0.26,H+2.2],[rr+0.55,rr+0.25,0.7,hh-2.0]]){ const ring=cylUV(new THREE.CylinderGeometry(r0,r1,h2,28), 14, h2); ring.translate(cx,yy,cz); geos.push(ring); }
        { const nM=Math.round(rr*4.4); for(let k=0;k<nM;k++){ const a=k/nM*6.283; geos.push(placed(stoneBox(0.62,1.05,0.55), cx+Math.cos(a)*(rr+0.3), hh-0.55, cz+Math.sin(a)*(rr+0.3), -a)); } }
        for(const y of [H*0.4, H*0.7, H+3]) for(const da of [-0.6,0,0.6]){ const sa=Math.atan2(onz,onx)+da; slit(cx+Math.cos(sa)*(rr+0.32), y, cz+Math.sin(sa)*(rr+0.32), -sa+Math.PI/2); }
        const rf=new THREE.Mesh(towerRoof(ST, rr*1.8, hh-0.6), capMat); rf.position.set(cx,0,cz); rf.castShadow=true; g.add(rf); }
      else keep(cx, cz, ry, onx, onz, FW, hh, 4);
      blocks.push({ mesh:g, x:f.x+cx, z:f.z+cz, r:FW*0.62, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'keep' }); }
    // Z145 THE GATEHOUSE: two tall keeps standing proud of the wall, a fighting gallery bridging the gate, a raised portcullis with its teeth showing,
    //   war banners down the towers, fire braziers and chevaux-de-frise out front — the face of the fort
    { const [x0,z0]=V[gi], [x1,z1]=V[(gi+1)%sides], L=Math.hypot(x1-x0,z1-z0), ux=(x1-x0)/L, uz=(z1-z0)/L, ry=-Math.atan2(z1-z0,x1-x0), mx=(x0+x1)/2, mz=(z0+z1)/2;
      const nx=-uz, nz=ux, sg=Math.sign(nx*mx+nz*mz)||1, onx=nx*sg, onz=nz*sg;                       // the outward normal (away from the centre)
      const CAP=f.tier===3, GH=H+FORT.arch.gateH[CAP?1:0], TW=FORT.arch.gateTW[CAP?1:0], off=FORT.gateW/2+TW/2, at=(l,o)=>[mx+ux*l+onx*o, mz+uz*l+onz*o];
      for(const sd of [-1,1]){ const [px,pz]=at(sd*off, 0.7); keep(px, pz, ry, onx, onz, TW, GH);
        const ban=new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4.2), bannerMat()); const [bx,bz]=at(sd*off, 0.7+TW/2+0.05); ban.position.set(bx, GH-4.4, bz); ban.rotation.y=Math.atan2(onx,onz); g.add(ban);
        const [hx,hz]=at(sd*off, 0.7+TW/2+0.12); dk.push(placed(new THREE.BoxGeometry(1.8,0.14,0.14), hx, GH-2.25, hz, ry));                                  // banner pole
        const [fx,fz]=at(sd*(off+TW/2+1.6), TH/2+2.4); dk.push(placed(new THREE.CylinderGeometry(0.1,0.16,1.5,8), fx, 0.75, fz, 0), placed(new THREE.CylinderGeometry(0.6,0.3,0.45,12), fx, 1.65, fz, 0));
        { const fl=flameFX(2.1, 1.4); fl.position.set(fx, 1.8, fz); g.add(fl); }   // brazier fire (Z235 a living flame)
        for(let k=0;k<3;k++){ const [cx,cz]=at(sd*(off-1.2+k*1.4), TH/2+5.2); for(const q of [-0.7,0.7]){ const st=new THREE.CylinderGeometry(0.08,0.1,3.0,6); st.rotateZ(q); st.rotateY(ry); st.translate(cx, 0.9, cz); wd.push(st); } } }   // chevaux-de-frise
      // Z241 the GATE HALL: a storey bridging the two gate towers above the fighting gallery — arcaded, with its own crenellated roof
      { const [hx,hz]=at(0, 0.5), HW=FORT.gateW+0.6, HY=H-0.2, HH=GH-H-3.4; if(HH>2){ geos.push(placed(stoneBox(HW, HH, TH*1.3), hx, HY+HH/2, hz, ry), placed(stoneBox(HW+0.5, 0.3, TH*1.3+0.5), hx, HY+HH+0.15, hz, ry), placed(stoneBox(HW+0.4, 0.26, TH*1.3+0.3), hx, HY+0.13, hz, ry));
          for(let k=0;k<3;k++){ const l=-HW/2+HW*(k+0.5)/3, [wx,wz]=at(l, 0.5+TH*0.65+0.02); dk.push(placed(new THREE.BoxGeometry(0.75, Math.min(2.4, HH*0.55), 0.14), wx, HY+HH*0.5, wz, ry)); }   // arcade windows
          for(let k=0;k<5;k++){ const l=-HW/2+0.5+k*(HW-1)/4, [mx2,mz2]=at(l, 0.5+TH*0.65-0.3); geos.push(placed(stoneBox(0.85,1.0,0.6), mx2, HY+HH+0.8, mz2, ry)); } } }
      // fighting gallery over the gate: deep, corbelled out, crenellated
      { const [gx2,gz2]=at(0, 0.3); geos.push(placed(stoneBox(FORT.gateW+0.8, 2.6, TH*1.6), gx2, H+1.1, gz2, ry)); }
      for(let k=0;k<5;k++){ const l=-FORT.gateW/2+0.6+k*(FORT.gateW-1.2)/4, [cx,cz]=at(l, 0.3+TH*0.8+0.2); geos.push(placed(stoneBox(0.9,0.95,0.5), cx, H+2.87, cz, ry)); const [kx,kz]=at(l, 0.3+TH*0.8+0.12); geos.push(placed(stoneBox(0.32,0.6,0.28), kx, H+0.05, kz, ry)); }
      { const [ex,ez]=at(0, 0.3+TH*0.8+0.1); geos.push(placed(stoneBox(6.7,2.05,0.32), ex, H+1.15, ez, ry), placed(stoneBox(7.1,0.22,0.5), ex, H+2.24, ez, ry), placed(stoneBox(7.1,0.22,0.5), ex, H+0.06, ez, ry));   // Z176 the gate's NAME STONE: a moulded frame…
        const pl=new THREE.Mesh(new THREE.PlaneGeometry(6.2,1.62), plaqueMat(f.name, biomePlace(BIOME.name), f.tier)); const [qx,qz]=at(0, 0.3+TH*0.8+0.27); pl.position.set(qx, H+1.15, qz); pl.rotation.y=Math.atan2(onx,onz); g.add(pl); f.plaque=pl; }   // …and the carved, gilded name
      // portcullis, raised: its lower bars and teeth hang below the gallery
      for(let k=0;k<=9;k++){ const l=-FORT.gateW/2+0.35+k*(FORT.gateW-0.7)/9, [bx,bz]=at(l, 0.62); dk.push(placed(new THREE.BoxGeometry(0.1,1.5,0.1), bx, H-0.95, bz, ry));
        const t=new THREE.ConeGeometry(0.09,0.4,5); t.rotateX(Math.PI); t.translate(bx, H-1.9, bz); dk.push(t); }
      for(const y of [H-1.4, H-0.6]){ const [hx,hz]=at(0, 0.62); dk.push(placed(new THREE.BoxGeometry(FORT.gateW-0.5,0.1,0.1), hx, y, hz, ry)); }
      // the gate: two iron-strapped timber leaves
      const gate=new THREE.Group(); gate.position.set(mx, 0, mz); gate.rotation.y=ry; g.add(gate); f.gp=[mx,mz,ry,GH,TW];   // Z279 where the gatehouse model goes
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
    if(f.tier===3){ const bx=f.x-f.gx, bz=f.z-f.gz, bl=Math.hypot(bx,bz)||1, ox=bx/bl, oz=bz/bl, d=f.Rin*0.42, kx=ox*d, kz=oz*d, ry=-Math.atan2(-ox,oz), KW=FORT.arch.keepW, KH=FORT.arch.keepH; f.dj=[kx,kz,ry,KW,KH];   // Z241 a towering donjon
      keep(kx, kz, ry, ox, oz, KW, KH, 7);
      const tx=Math.cos(-ry), tz=Math.sin(-ry); for(const a of [-1,1]) for(const b of [-1,1]) keep(kx+tx*a*KW/2+ox*b*KW/2, kz+tz*a*KW/2+oz*b*KW/2, ry, ox, oz, 4.4, KH+FORT.arch.turret);
      for(const [a,b] of [[0,1],[0,-1],[1,0],[-1,0]]){ const ban=new THREE.Mesh(new THREE.PlaneGeometry(2.2, 6.5), bannerMat()); ban.position.set(kx+tx*a*(KW/2+0.32)+ox*b*(KW/2+0.32), KH-6, kz+tz*a*(KW/2+0.32)+oz*b*(KW/2+0.32)); ban.rotation.y=Math.atan2(tx*a+ox*b, tz*a+oz*b); g.add(ban); }
      { const [sx,sz]=[kx-ox*(KW/2+1.2), kz-oz*(KW/2+1.2)]; for(let k=0;k<6;k++) geos.push(placed(stoneBox(4.2, 0.5*(k+1), 0.9), sx-ox*(5-k)*0.9, 0.25*(k+1), sz-oz*(5-k)*0.9, ry)); }   // the great stair to the keep door
      { const [dx,dz]=[kx-ox*(KW/2+0.06), kz-oz*(KW/2+0.06)]; const door=new THREE.Mesh(new THREE.BoxGeometry(2.6,4.2,0.2), _wood); door.position.set(dx, 2.1+3, dz); door.rotation.y=ry; g.add(door); }
      f.keepX=kx; f.keepZ=kz; f.keepY=KH+0.4; f.keepR=KW*0.72;
      const kb=new THREE.Group(); kb.position.set(kx,0,kz); g.add(kb); blocks.push({ mesh:kb, x:f.x+kx, z:f.z+kz, r:KW*0.72, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'keep', _top:f.gy+KH, _topHp:Infinity }); }   // Z380 (an empty group carries it: it stood 2 m high to rounds and eyes — the donjon is KH)
    f.lk=null; if(f.look && f.look.keep && SCENERY.models[f.look.keep]){ const L=f.look, bx=f.x-f.gx, bz=f.z-f.gz, bl=Math.hypot(bx,bz)||1, ox=bx/bl, oz=bz/bl, d=f.dj ? Math.hypot(f.dj[0], f.dj[1]) : f.Rin*L.at, kx=ox*d, kz=oz*d;   // Z457 the castle crowning this fort's yard (REALFORT.looks): a real model where its keep stands — the capital's on its ward, the others' at the back of the yard, facing the gate
      const ry=-Math.atan2(-ox,oz)+(L.turn||0), D=sceneDims(L.keep), s=Math.min(L.h/D.y, f.Rin*L.w/Math.max(D.x,D.z), f.ward && f.dj ? f.ward.r*2*(L.wardK||1)/Math.max(D.x,D.z) : Infinity),   // (as tall as h — over the walls — but never wider than w × Rin, nor than the capital's ward)
      wh=f.ward && f.dj ? f.ward.h : 0, top=D.y*s+wh;
      f.lk=[kx, kz, ry, s, wh]; f.keepX=kx; f.keepZ=kz; f.keepY=top*L.flag; f.keepR=Math.max(D.x,D.z)*s*0.5; const kb=new THREE.Group(); kb.position.set(kx,0,kz); g.add(kb);
      blocks.push({ mesh:kb, x:f.x+kx, z:f.z+kz, r:Math.max(D.x,D.z)*s*0.5, obb:{ f:ry, hl:D.z*s/2*L.solid, hw:D.x*s/2*L.solid }, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'keep', _top:f.gy+top, _topHp:Infinity }); }   // (its whole footprint solid: an oriented box, not the donjon's circle)
    { f.towerFlags=[]; const poles=[]; for(const [px,pz,top] of FLAGS.slice(0, MOBILE?6:10)){ const pole=new THREE.CylinderGeometry(0.07,0.1,8.5,8); pole.translate(px, top+3.75, pz); poles.push(pole); const ball=new THREE.SphereGeometry(0.16,8,6); ball.translate(px, top+8.05, pz); poles.push(ball);
        const fl=makeFlag(campFlagTex(), 2.9, 1.85, 1); fl.position.set(px, top+7.0, pz); g.add(fl); f.towerFlags.push(fl); }
      if(poles.length){ const pm=new THREE.Mesh(mergeGeometries(poles.map(q=>q.index?q.toNonIndexed():q), false), _iron); poles.forEach(q=>q.dispose()); pm.castShadow=true; g.add(pm); } }
    buildCore(f, g, WM);   // Z176 the heart of the fort
    const wall=new THREE.Mesh(mergeGeometries(geos.map(q=>q.index?q.toNonIndexed():q), false), WM); geos.forEach(q=>q.dispose()); wall.castShadow=true; wall.receiveShadow=true; g.add(wall);
    for(const [arr,mt] of [[dk,_iron],[wd,_wood]]) if(arr.length){ const m=new THREE.Mesh(mergeGeometries(arr.map(q=>q.index?q.toNonIndexed():q), false), mt); arr.forEach(q=>q.dispose()); m.castShadow=true; g.add(m); (f.deco||(f.deco=[])).push(m); }   // Z145
    { const im=new THREE.InstancedMesh(pieceGeo(), WM, f.pieces.length); for(const pc of f.pieces){ _m.compose(_p.set(pc.cx,0,pc.cz), _q.setFromAxisAngle(_up, pc.ry), _s.set(pc.pl/FORT.seg+0.02,1,1)); im.setMatrixAt(pc.i, _m); }
      im.instanceMatrix.needsUpdate=true; im.computeBoundingSphere(); im.castShadow=true; im.receiveShadow=true; g.add(im); f.wallIM=im;
      { const di=new THREE.InstancedMesh(pieceDarkGeo(), _iron, f.pieces.length); for(const pc of f.pieces){ im.getMatrixAt(pc.i, _m); di.setMatrixAt(pc.i, _m); } di.instanceMatrix.needsUpdate=true; di.computeBoundingSphere(); g.add(di); f.darkIM=di; }   // Z241 loops · ports · murder-holes
      const cg=capGeo(ST, H, TH, FORT.seg); if(cg){ const ci=new THREE.InstancedMesh(cg, capMat, f.pieces.length); for(const pc of f.pieces){ im.getMatrixAt(pc.i, _m); ci.setMatrixAt(pc.i, _m); } ci.instanceMatrix.needsUpdate=true; ci.computeBoundingSphere(); ci.castShadow=true; g.add(ci); f.capIM=ci; } }   // every wall section in ONE draw call · Z140 + its regional cap (stakes / snow / wire / tiles)
    dressFort(f, wall);   // Z279 the colossal Tripo fortress, once its pieces are in
    buildOutpost(f);   // Z285 its camp outside the walls
    // corner watchtowers (real towers: guards, collapse, loot)
    const tw=[]; for(let i=0;i<sides && tw.length<(realFort() ? 0 : T.towers);i++){ const k=(gi+1+Math.round(i*sides/T.towers))%sides; const [vx,vz]=V[k]; tw.push([f.x+vx*0.86, f.z+vz*0.86]); }   // Z434 not inside a real fort: its corner towers are the wall's own (a second, steel one beside each was clutter)
    for(const [x,z] of tw) buildTower(x, z);
    // riflemen along the wall walk — a pseudo watchtower so they aim/fire/fall exactly like tower guards (and our men can shoot them)
    const body=new THREE.Group(); g.add(body); const guards=[], nG=Math.round(R2(T.gunners)*(MOBILE?FORT.mobileMul:1));
    for(let k=0;k<nG;k++){ const i=(k<nG*0.45) ? gi : (k%sides), [x0,z0]=V[i], [x1,z1]=V[(i+1)%sides]; let u=0.12+Math.random()*0.76; if(i===gi && Math.abs(u-0.5)<0.2) u=u<0.5?0.22:0.78;
      const s=makeSoldierMesh({enemy:true}); s.scale.setScalar(HUMAN_SCALE); const px=x0+(x1-x0)*u, pz=z0+(z1-z0)*u; s.position.set(px*0.97, H-0.05, pz*0.97); body.add(s);
      guards.push({ g:s, alive:true, fireAt:performance.now()/1000+1+Math.random()*3 }); }
    const pt={ g, body, x:f.x, z:f.z, guards, sl:new THREE.Object3D(), beam:{ material:{ opacity:0 } }, wm:null, hp:Infinity, falling:false, fort:f };
    towers.push(pt); f.pt=pt;
    // banner of the garrison over the keep + a name board
    { const PH=FORT.arch.flagH[f.tier===3?1:0], fg=new THREE.Group(); g.add(fg); f.flagG=fg; f.flagH=PH;                      // Z140 a tall flagpole over the keep (it topples when the fort falls)
      const base=new THREE.Mesh(new THREE.CylinderGeometry(0.9,1.2,1.2,10), _iron); base.position.set(f.keepX||0, (f.keepY||0)+0.6, f.keepZ||0); g.add(base); fg.position.set(f.keepX||0, f.keepY||0, f.keepZ||0);   // Z145 the capital's flag flies from the donjon roof
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.16,PH,8), _iron); pole.position.set(0, PH/2, 0); pole.castShadow=true; fg.add(pole);
      const ball=new THREE.Mesh(new THREE.SphereGeometry(0.28,10,8), new THREE.MeshStandardMaterial({ color:0xc8a040, metalness:0.8, roughness:0.3 })); ball.position.y=PH+0.2; fg.add(ball);
      const fl=makeFlag(campFlagTex(), f.tier===3?5.4:4.4, f.tier===3?3.4:2.8, 1); fl.position.set(0, PH-1.8, 0); fg.add(fl); f.flag=fl; }
    // inner cover: sandbag lines, crates, HESCO and concrete — room to fight, things to duck behind
    { const nC=Math.round(R2(T.cover)*FORT.coverK*(MOBILE?0.7:1)), kinds=['sandbag','crates','sandbag','hesco'], gA=Math.atan2(f.gz-f.z, f.gx-f.x);   // Z434 fewer, and only what a garrison lays out (no stray concrete lumps or drums)
      for(let k=0,t=0;k<nC && t<nC*8;t++){ const a=Math.random()*Math.PI*2, r=f.R*(0.32+Math.random()*0.46); if(Math.abs(Math.atan2(Math.sin(a-gA),Math.cos(a-gA)))<0.35 && r>f.R*0.5) continue;   // keep the gate lane open
        const x=f.x+Math.cos(a)*r, z=f.z+Math.sin(a)*r; if(blocks.some(b=>b.fort===f && b.kind==='cover' && Math.hypot(b.x-x,b.z-z)<5)) continue; if(f.keepR && Math.hypot(x-f.x-f.keepX, z-f.z-f.keepZ)<f.keepR+4) continue; if(f.coreR && Math.hypot(x-f.x-f.coreX, z-f.z-f.coreZ)<f.coreR+3) continue;
        const kind=kinds[(Math.random()*kinds.length)|0], steel=kind==='hesco'||kind==='concrete', m=makeCoverMesh(kind, true); m.position.set(x, gy-0.12, z); m.rotation.y=a+Math.PI/2+(Math.random()-0.5)*0.4; scene.add(m);
        const hp=COVER_HP[kind]||70; blocks.push({ mesh:m, x, z, r:1.7, hp, maxHp:hp, steel, heavy:steel, cover:true, loot:Math.random()<0.25, kind, fortCover:f }); k++; } }   // Z193 the yard's HESCO / concrete break too
    f.label=nameSprite(f.name, f.tier===3?'#ffb35a':'#ff8a6a'); f.label.position.set(f.keepX||0, (f.flagH||12)+(f.keepY||0)+3, f.keepZ||0); g.add(f.label);
    buildHatches(f);
    const st0=Math.min(4,S.stage-1); f.pool={ inf:Math.round(R2(T.inf)*(MOBILE?FORT.mobileMul:1)*(1+st0*0.12)) };
    if(hillCfg()){ if(f.tier===3 && hillCfg().open) openCitadel(f); paveYard(f, f.x, f.z, f.openCitadel ? f.R+1 : (f.Rin||f.R*0.85)-0.6); }   // Z453 the citadel open in front, every yard paved
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
    if(f.keepR && Math.hypot(x-f.x-f.keepX, z-f.z-f.keepZ)<f.keepR+3) continue; if(f.coreR && Math.hypot(x-f.x-f.coreX, z-f.z-f.coreZ)<f.coreR+3) continue; if(f.hatches.some(h=>Math.hypot(h.x-x,h.z-z)<9)) continue; if(blocks.some(b=>b.fortCover===f && Math.hypot(b.x-x,b.z-z)<3)) continue;
    f.hatches.push(makeHatch(f, x, z)); } }
function popHatch(h){ h.want=1; h.shutAt=performance.now()/1000+3.5; const gy=heightAt(h.x,h.z);
  burst({x:h.x, z:h.z}, 0x8a7a64, 8, 4, {y:gy+0.6, life:1.0, size:1.4, smoke:true, grav:-0.6, drag:1.8, up:2.4, op:0.5}); sfx('clang', {x:h.x, z:h.z}); }
function animHatches(f, dt, now){ for(const h of (f.hatches||[])){ if(h.want && now>h.shutAt) h.want=0; const k=h.want?6:2.2; h.open+=(h.want-h.open)*Math.min(1, dt*k); h.hinge.rotation.x=-h.open*1.95; } }
// a squad climbs out at (x,z): 3–5 riflemen, one or two with RPGs
function squadAt(f, x, z, n, inside){ const out=[]; for(let k=0;k<n;k++){ const a=Math.random()*6.283, r=0.6+Math.random()*2.2, type=(k===0 || (k===3 && S.stage>=3)) ? 'rpg' : 'rifle';
    const e=inside ? spawnAt(f, type, x+Math.cos(a)*r, z+Math.sin(a)*r) : spawnEnemy(type, x+Math.cos(a)*r, z+Math.sin(a)*r); if(!e) continue; e.fortOf=f; if(!inside) f.units.push(e); out.push(e); }
  if(!inside) makeSquad(out); return out; }   // Z173 a tunnel squad fights as one
// Z176 NAME STONE — dark polished granite, a double gilt border, the fort's name cut in gold capitals, the place beneath
function plaqueMat(name, place, tier){ const c=document.createElement('canvas'); c.width=1024; c.height=268; const x=c.getContext('2d');
  const gr=x.createLinearGradient(0,0,0,268); gr.addColorStop(0,'#2b2a27'); gr.addColorStop(0.5,'#1c1b19'); gr.addColorStop(1,'#262420'); x.fillStyle=gr; x.fillRect(0,0,1024,268);
  for(let i=0;i<900;i++){ x.fillStyle='rgba(255,255,255,'+(Math.random()*0.05)+')'; x.fillRect(Math.random()*1024, Math.random()*268, 2, 2); }   // granite fleck
  const gold=x.createLinearGradient(0,40,0,230); gold.addColorStop(0,'#f6dc8a'); gold.addColorStop(0.45,'#c8962e'); gold.addColorStop(0.55,'#e8c060'); gold.addColorStop(1,'#9a6a1c');
  x.strokeStyle=gold; x.lineWidth=7; x.strokeRect(14,14,996,240); x.lineWidth=2.5; x.strokeRect(30,30,964,208);
  for(const [cx,cy] of [[30,30],[994,30],[30,238],[994,238]]){ x.fillStyle=gold; x.beginPath(); x.arc(cx,cy,9,0,7); x.fill(); }
  x.textAlign='center'; x.textBaseline='middle'; let fs=118; x.font='900 '+fs+'px "Saira Condensed", Rajdhani, sans-serif'; while(x.measureText(name).width>900 && fs>60){ fs-=4; x.font='900 '+fs+'px "Saira Condensed", Rajdhani, sans-serif'; }
  x.fillStyle='rgba(0,0,0,0.75)'; x.fillText(name, 515, 112); x.fillStyle=gold; x.fillText(name, 512, 108);   // cut shadow + gilt
  x.font='700 40px "Saira Condensed", Rajdhani, sans-serif'; x.fillStyle='#c8a860'; x.fillText((tier===3?'★ ★ ★  ':tier===2?'★ ★  ':'★  ')+(place||'')+(tier===3?'  ★ ★ ★':tier===2?'  ★ ★':'  ★'), 512, 206);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8;
  return new THREE.MeshStandardMaterial({ map:t, roughness:0.38, metalness:0.35, emissive:0xffffff, emissiveMap:t, emissiveIntensity:0.22 }); }
// Z176 THE CORE — every fort keeps its command post in the yard: a stone block-house with a door and steps facing the gate, windows, a parapet roof with
//   sandbags, a radio mast with a dish and a red beacon, the garrison flag and a name board. It can be shelled to ruins (only once the walls are broken —
//   a sealed fort lets nothing in); when it falls the fort loses most of its reserves and stops sending troops out.
const CORE_NAME={ 1:'TRẠM CHỈ HUY', 2:'SỞ CHỈ HUY', 3:'BỘ TỔNG HÀNH DINH' };
function buildCore(f, g, WM){ const gdx=(f.gx-f.x)/(Math.hypot(f.gx-f.x, f.gz-f.z)||1), gdz=(f.gz-f.z)/(Math.hypot(f.gx-f.x, f.gz-f.z)||1), side=Math.random()<0.5?-1:1;
  const lx=-gdz*side*(f.Rin||f.R)*0.4 + gdx*(f.Rin||f.R)*0.05, lz=gdx*side*(f.Rin||f.R)*0.4 + gdz*(f.Rin||f.R)*0.05, ry=Math.atan2(gdx, gdz), W2=4.5, D2=3.5, H2=4.2;
  if(cmdCompound(f, g, WM, lx, lz, ry, -side)) return;   // Z420 the real bunkers (the drawn block-house only without them)
  const SG=[], DK=[], IR=[], BG=[], put=(L,geo,x,y,z,rx,ryy)=>{ geo.rotateX(rx||0); geo.rotateY(ryy||0); geo.translate(x,y,z); L.push(geo); };
  put(SG, stoneBox(W2*2+1, 0.5, D2*2+1), 0,0.25,0); put(SG, stoneBox(W2*2, H2, D2*2), 0,0.5+H2/2,0); put(SG, stoneBox(W2*2+0.2, 0.22, D2*2+0.2), 0,2.6,0);
  put(SG, stoneBox(W2*2+0.6, 0.35, D2*2+0.6), 0,0.5+H2+0.17,0);
  for(let k=0;k<10;k++){ const u=-W2+0.5+k*(W2*2-1)/9; put(SG, stoneBox(0.7,0.7,0.35), u,H2+1.0,D2+0.12); put(SG, stoneBox(0.7,0.7,0.35), u,H2+1.0,-D2-0.12); }
  for(let k=0;k<8;k++){ const u=-D2+0.5+k*(D2*2-1)/7; put(SG, stoneBox(0.35,0.7,0.7), W2+0.12,H2+1.0,u); put(SG, stoneBox(0.35,0.7,0.7), -W2-0.12,H2+1.0,u); }
  put(SG, stoneBox(2.6,3.2,0.3), 0,2.1,D2+0.05); put(DK, new THREE.BoxGeometry(1.8,2.6,0.12), 0,1.8,D2+0.22); for(let k=0;k<3;k++) put(SG, stoneBox(3.2-k*0.3,0.22,0.8), 0,0.11+k*0.2,D2+1.0-k*0.3);   // door, frame, steps
  for(const x of [-3.0,-1.9,1.9,3.0]) put(DK, new THREE.BoxGeometry(0.75,1.0,0.1), x,3.2,D2+0.03); for(const z of [-1.6,1.6]) for(const sx of [-1,1]) put(DK, new THREE.BoxGeometry(0.1,1.0,0.9), sx*(W2+0.03),3.2,z);
  { const MH=8.5, mx=-W2+1.4, mz=-D2+1.3, y0=0.5+H2+0.35; for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ const leg=new THREE.CylinderGeometry(0.04,0.06,MH,6), dx=a*0.32, dz=b*0.32; leg.translate(mx+dx*0.5, y0+MH/2, mz+dz*0.5); IR.push(leg); }
    for(let y=1;y<MH;y+=1.4){ const r=new THREE.BoxGeometry(0.62,0.04,0.04); r.translate(mx,y0+y,mz); IR.push(r); }
    const dish=new THREE.CylinderGeometry(0.75,0.25,0.25,16); dish.rotateX(1.2); dish.translate(mx+0.3,y0+MH*0.72,mz+0.5); IR.push(dish); f.coreBeacon=[mx, y0+MH+0.15, mz]; }
  for(let k=0;k<5;k++){ const b=new RoundedBoxGeometry(0.95,0.3,0.45,1,0.11); b.rotateY(Math.PI/2); b.translate(W2-0.6, 0.5+H2+0.55+(k>2?0.28:0), -1.2+(k%3)*1.0); BG.push(b); }
  const cg=new THREE.Group(); cg.position.set(lx, 0, lz); cg.rotation.y=ry; g.add(cg);
  const mk=(L,mat)=>{ if(!L.length) return; const m=new THREE.Mesh(mergeGeometries(L.map(q=>q.index?q.toNonIndexed():q), false), mat); L.forEach(q=>q.dispose()); m.castShadow=true; m.receiveShadow=true; cg.add(m); };
  mk(SG, WM.clone()); mk(DK, _iron); mk(IR, _iron); mk(BG, coverMat('sandbag'));
  const bc=new THREE.Mesh(new THREE.SphereGeometry(0.14,8,6), new THREE.MeshBasicMaterial({ color:0xff2a1a })); bc.position.set(...f.coreBeacon); cg.add(bc); f.coreBc=bc;
  { const fg=new THREE.Group(); fg.position.set(W2-1.0, 0.5+H2+0.35, D2-0.9); cg.add(fg); const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,5,8), _iron); pole.position.y=2.5; fg.add(pole);
    const fl=makeFlag(campFlagTex(), 2.2, 1.4, 1); fl.position.set(0, 4.2, 0); fg.add(fl); f.coreFlag=fl; }
  if(FORT_CMD.board){ const sg=new THREE.Mesh(new THREE.PlaneGeometry(3.3,0.62), plaqueMat(CORE_NAME[f.tier]||'SỞ CHỈ HUY', f.name, 0)); sg.position.set(0, 4.0, D2+0.22); cg.add(sg); }
  f.core={ g:cg, mat:cg.children[0].material }; f.coreX=lx; f.coreZ=lz; f.coreR=Math.hypot(W2,D2)+0.6;
  const hp=Math.round(FORT.tiers[f.tier].gate*1.3*(1+FORT.gatePerStage*(S.stage-1))*loopHpMul()*diffHpMul());
  const b={ mesh:cg, x:f.x+lx, z:f.z+lz, r:Math.hypot(W2,D2), obb:{ hl:D2+0.5, hw:W2+0.5, f:ry }, hp, maxHp:hp, steel:false, loot:false, kind:'fortcore', fort:f }; blocks.push(b); f.coreBlock=b; }
// Z420 THE COMMAND COMPOUND: FORT_CMD's bunkers for this tier, laid round the core's spot in its frame (+z toward the gate, +x = out, the fort's
//   outer side — the comms stand behind the main building, out of the gate's line, the guns cover the yard between it and the gate). Every piece is a
//   'fortcore' block sharing one HP; the drawn block-house is not built. o = which way is out across the core's frame
function cmdCompound(f, g, WM, lx, lz, ry, o){ const C=FORT_CMD; if(!C.on || typeof window==='undefined' || /procbase|noscene/.test(location.search+location.hash)) return false;
  const list=C.tiers[f.tier]||C.tiers[1], k=MOBILE?C.k.mobile:1, cg=new THREE.Group(); cg.position.set(lx, 0, lz); cg.rotation.y=ry; g.add(cg);
  const hp=Math.round(FORT.tiers[f.tier].gate*1.3*(1+FORT.gatePerStage*(S.stage-1))*loopHpMul()*diffHpMul()), cr=Math.cos(ry), sr=Math.sin(ry), parts=[], tone=landTone(); let rad=0, main=null;
  for(const [keys, px, pz, yaw, role] of list){ const opts=keys.split('|'), key=opts[(Math.random()*opts.length)|0], sc=(C.scale && C.scale[f.tier])||1, D=sceneDims(key, sc), x=px*k*o, z=pz*k, yl=yaw*o;
    const lod=scenePiece(key, sc, { tone }); lod.scale.setScalar(sc); lod.position.set(x, 0, z); lod.rotation.y=yl; cg.add(lod);   // (Z434 sc: the fort's heart a little bigger than its scan)
    const wx=f.x+lx+x*cr+z*sr, wz=f.z+lz-x*sr+z*cr, r=Math.hypot(D.x, D.z)/2;
    const b={ mesh:main?lod:cg, x:wx, z:wz, r:r*0.9, obb:{ hw:D.x/2*0.92, hl:D.z/2*0.92, f:ry+yl }, hp, maxHp:hp, steel:false, loot:false, kind:'fortcore', fort:f, _top:f.gy+D.y };
    blocks.push(b); parts.push({ key, role, x, z, D, lod, b }); rad=Math.max(rad, Math.hypot(x, z)+r); if(!main) main=parts[0]; }
  const comms=parts.find(p=>p.role==='comms'), M0=main.D;
  { const q=comms||main, bc=new THREE.Mesh(new THREE.SphereGeometry(0.22,8,6), new THREE.MeshBasicMaterial({ color:0xff2a1a })); bc.position.set(q.x, q.D.y+0.35, q.z); cg.add(bc); f.coreBc=bc; }   // the mast's red beacon (Z434 on the roof when there is no mast)
  { const fg=new THREE.Group(); fg.position.set(-o*(M0.x/2+1.6), 0, M0.z/2+1.6); cg.add(fg); const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.1,8,8), _iron); pole.position.y=4; pole.castShadow=true; fg.add(pole);
    const fl=makeFlag(campFlagTex(), 2.4, 1.5, 1); fl.position.set(0, 7.1, 0); fg.add(fl); f.coreFlag=fl; }   // the garrison flag at the door
  if(C.board){ const sg=new THREE.Mesh(new THREE.PlaneGeometry(3.3,0.62), plaqueMat(CORE_NAME[f.tier]||'SỞ CHỈ HUY', f.name, 0)); sg.position.set(o*(M0.x*0.18), 1.6, M0.z/2+3.2); cg.add(sg);
    const post=new THREE.Mesh(new THREE.BoxGeometry(3.5,0.08,0.08), _iron); post.position.set(sg.position.x, 1.25, sg.position.z-0.03); cg.add(post);
    for(const s of [-1.5,1.5]){ const leg=new THREE.Mesh(new THREE.BoxGeometry(0.08,1.9,0.08), _iron); leg.position.set(sg.position.x+s, 0.95, sg.position.z-0.05); cg.add(leg); } }   // the name board on two legs before the door
  f.core={ g:cg, mat:null, ruinMat:WM, W2:M0.x/2*0.8, D2:M0.z/2*0.8, parts }; f.coreX=lx; f.coreZ=lz; f.coreR=rad+FORT_CMD.rim; f.coreBlock=main.b; f.coreBlocks=parts.map(p=>p.b);
  return true; }
// shells on the command post: stone chips and dust; at zero it is blown to ruins (Z420 any piece of the compound wears the one HP)
export function fortCoreHit(b, dmg){ const f=b.fort; if(!f || f.coreDown || !blocks.includes(b)) return; const c=f.coreBlock||b; c.hp-=dmg; for(const q of (f.coreBlocks||[])) q.hp=c.hp; if(!f.active) wakeFort(f, performance.now()/1000);
  flashMat(f.core.mat, 0.1, 0.5); burst({x:b.x,z:b.z}, 0xa89a84, 3, 5, {y:f.gy+1+Math.random()*3.5, life:0.5, size:0.32, grav:-16, drag:1.4, up:2.5});
  if(c.hp<=0) coreDestroyed(f, c); }
function coreDestroyed(f, b){ for(const q of (f.coreBlocks||[b])){ const i=blocks.indexOf(q); if(i>=0) blocks.splice(i,1); } f.coreDown=true; const now=performance.now()/1000, cx=f.x+f.coreX, cz=f.z+f.coreZ;
  (f.core.parts||[]).forEach((p,i)=>{ if(i) setTimeout(()=>{ bigExplode({x:p.b.x,z:p.b.z}, 0xff8a3a, 1.6); for(let k=0;k<4;k++) spawnDebris({x:p.b.x,z:p.b.z}, 1.2, 0x7a7266); }, 300+i*260); });   // Z420 every bunker of the compound goes up in turn
  bigExplode({x:cx,z:cz}, 0xffa040, 2.6); setTimeout(()=>bigExplode({x:cx+1.5,z:cz-1}, 0xff7a2a, 1.8), 220); for(let k=0;k<8;k++) spawnDebris({x:cx,z:cz}, 1.4, 0x8a8070);
  burst({x:cx,z:cz}, 0xb8a888, 14, 6, {y:f.gy+2, life:2.2, size:3.2, smoke:true, grav:-0.4, drag:1.4, up:2.2, op:0.6}); S.shake=Math.min(3.4, S.shake+1.6); sfx('bigexplode');
  unwave(f.core.g); f.g.remove(f.core.g); coreCrater(f); f.coreFireUntil=now+FORT.coreFire;
  f.pool.inf=Math.floor(f.pool.inf*0.35);
  showBanner((CORE_NAME[f.tier]||'SỞ CHỈ HUY')+' '+f.name+' ĐÃ SẬP!', '#ffb35a');
  radio('SCH: '+(CORE_NAME[f.tier]||'Sở chỉ huy').toLowerCase().replace(/^./,ch=>ch.toUpperCase())+' của '+f.name+' đã sập — chúng mất liên lạc, hết quân tiếp viện!'); }
// Z434 the command post goes up and leaves a crater: the ground blown out where it stood (a pit inside a thrown-up rim), scorched and ashed, and it burns —
//   flames among the wreck for a while, smoke for longer; no drawn heap of bricks and slabs (the old ruins read as a pile of toy blocks)
function coreCrater(f){ const cx=f.x+f.coreX, cz=f.z+f.coreZ, r=Math.max(4.5, Math.min(9, (f.core.W2||4.5)+1.5)), C=FORT.crater;
  heapGround(cx, cz, r*1.35, C.rim); heapGround(cx, cz, r*0.85, -C.depth); breakScar(cx, cz, r, true); decalScorch(cx, cz, r*1.9, 0.9);
  const fl=[]; for(let i=0;i<(MOBILE?2:4);i++){ const a=i/4*Math.PI*2+Math.random(), d=r*(0.25+Math.random()*0.5), x=cx+Math.cos(a)*d, z=cz+Math.sin(a)*d, m=flameFX(1.4+Math.random()*1.2, 1.1+Math.random()*0.8); m.position.set(x, heightAt(x,z)+0.1, z); scene.add(m); fl.push(m); }
  setTimeout(()=>{ for(const m of fl) scene.remove(m); }, FORT.coreFire*1000); }
function nameSprite(text, col){ const c=document.createElement('canvas'); c.width=512; c.height=96; const x=c.getContext('2d');
  x.fillStyle='rgba(10,6,4,.72)'; x.beginPath(); x.roundRect(8,14,496,68,14); x.fill(); x.strokeStyle=col; x.lineWidth=3; x.stroke();
  x.fillStyle=col; x.font='900 40px "Saira Condensed", Rajdhani, sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(text, 256, 50);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({ map:t, depthTest:false, transparent:true })); s.scale.set(16, 3, 1); s.renderOrder=8; return s; }

// ---- wall hits: a shot that strikes the wall top near a rifleman knocks him off ----
// ---- wall sections: shells chip them (half damage), rams crack them; a section that falls takes its weaker neighbour → a ~6 m breach ----
export function fortWallDamage(b, dmg, ram){ const f=b.fort; if(!f || !blocks.includes(b)) return; const now=performance.now()/1000;
  b.hp -= ram ? dmg : dmg*FORT.wallShotK; if(!f.active) wakeFort(f, now);
  burst({x:b.x,z:b.z}, 0xa89a84, ram?6:2, ram?6:3, {y:f.gy+1+Math.random()*3, life:0.6, size:ram?0.5:0.3, grav:-16, drag:1.4, up:2.5});
  if(b.hp<=0){ collapsePiece(f, b.piece, now); const pc=b.piece, nb=[pc.prev, pc.next].filter(q=>q && blocks.includes(q.block)).sort((a,c)=>a.block.hp-c.block.hp)[0]; if(nb) collapsePiece(f, nb, now); } }
function collapsePiece(f, pc, now){ const b=pc.block, i=blocks.indexOf(b); if(i<0) return; blocks.splice(i,1); pc.down=true; f.lastBreach=pc;
  _m.makeScale(0,0,0); f.wallIM.setMatrixAt(pc.i, _m); f.wallIM.instanceMatrix.needsUpdate=true; if(f.wallSl && f.wallSl[pc.i]){ const [im,j]=f.wallSl[pc.i]; im.setMatrixAt(j, _m); im.instanceMatrix.needsUpdate=true; } if(f.capIM){ f.capIM.setMatrixAt(pc.i, _m); f.capIM.instanceMatrix.needsUpdate=true; } if(f.darkIM){ f.darkIM.setMatrixAt(pc.i, _m); f.darkIM.instanceMatrix.needsUpdate=true; }
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
  if(!BREAKUP.heaps){ decalAsh(f.x+pc.cx, f.z+pc.cz, pc.pl*0.7+2, 0.6); return; }   // Z418 no slabs and bars strewn over the breach: torn earth and a grey burn
  for(let k=0;k<n;k++){ const s=(Math.random()-0.5)*(pc.pl+2.4), o=(Math.random()-0.4)*(k<4?1.6:6.4), lx=pc.cx+pc.ux*s+nx*o, lz=pc.cz+pc.uz*s+nz*o;   // the big slabs stay on the wall line, the smaller ones spill out
    const big=k<4, sx=big?1.6+Math.random()*1.3:0.5+Math.random()*0.8, sy=big?0.7+Math.random()*0.6:0.35+Math.random()*0.4, sz=big?1.1+Math.random()*0.9:0.45+Math.random()*0.7;
    const g=V[(Math.random()*V.length)|0].clone(); g.scale(sx, sy, sz); g.rotateX((Math.random()-0.5)*(big?0.9:1.6)); g.rotateZ((Math.random()-0.5)*(big?0.9:1.6)); g.rotateY(Math.random()*Math.PI);
    g.translate(lx, heightAt(f.x+lx, f.z+lz)-f.gy+sy*0.18, lz); geos.push(g);
    if(big) for(let q=0;q<3;q++){ const b=new THREE.CylinderGeometry(0.04,0.04,1.2+Math.random()*1.2,5); b.rotateZ(0.5+Math.random()*1.0); b.rotateY(Math.random()*6.28); b.translate(lx+(Math.random()-0.5)*sx*0.6, heightAt(f.x+lx, f.z+lz)-f.gy+sy*0.6, lz+(Math.random()-0.5)*sz*0.6); bars.push(b); } }   // twisted rebar
  const mt=(f.wallMat && matList(f.wallMat)[0])||(f.wallIM&&f.wallIM.material)||_stone, m=new THREE.Mesh(mergeGeometries(geos, false), mt); geos.forEach(g=>g.dispose()); m.castShadow=true; m.receiveShadow=true; f.g.add(m);
  if(bars.length){ const bm=new THREE.Mesh(mergeGeometries(bars.map(q=>q.index?q.toNonIndexed():q), false), _iron); bars.forEach(g=>g.dispose()); f.g.add(bm); } }
// ---- ramming: the tank's closing speed into a gate / wall section (called by physics on contact) ----
export function fortWallHit(b, dmg){ fortWallDamage(b, dmg, false); const f=b.fort; if(!f || !f.pt) return; let best=null, bd=4.2;
  for(const gd of f.pt.guards){ if(!gd.alive || gd.wx==null) continue; const d=Math.hypot(gd.wx-b.x, gd.wz-b.z); if(d<bd){ bd=d; best=gd; } }
  if(best && (dmg>=12 || Math.random()<0.5)){ const p=S.player, ux=best.wx-(p?p.pos.x:0), uz=best.wz-(p?p.pos.z:0), L=Math.hypot(ux,uz)||1;
    dropGuard(f.pt, best, ux/L, uz/L); floatText('HẠ LÍNH TRÊN TƯỜNG', '#ffcf5a', new THREE.Vector3(b.x, f.gy+FORT.wallH+2, b.z), 14); } }
// ---- the gate: batter it open ----
export function damageGate(b, dmg){ const f=b.fort; if(!f || f.breached) return; const now=performance.now()/1000;
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
  if(f.tier===3 && !f.duel){ f.duel=true; startBoss(now, f); } }   // the citadel's commander IS the stage boss: the general takes the field (campaign/boss.js)
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
function updateGate(f, dt, now){ if(!f.leaves || f.breached) return;   // Z315 every gate stands open, the citadel's too — a man goes in through it
  if(f.gv < 1 || f.gateShut){ f.gv = 1; for(const L of f.leaves) L.g.rotation.y = L.s*1.45; f.gateShut = false; const i = blocks.indexOf(f.gate); if(i >= 0) blocks.splice(i, 1); } }
// --- posture: our strength near the walls vs the garrison → HOLD (shut the gate) or SALLY (open up and hit us) ---
function strength(f){ const P=FORT.posture, p=S.player, near=f.R+P.near; let ours=P.you*Math.max(0.15, p.hp/p.maxHp);
  for(const a of FT) if(Math.hypot(a.pos.x-f.x, a.pos.z-f.z) < near) ours+=P.inf;
  let theirs=0; for(const e of f.units) if(enemies.includes(e) && !e.exit && Math.hypot(e.pos.x-f.x, e.pos.z-f.z) < f.R) theirs += e.commander ? P.gCmd : P.gInf;
  for(const e of (f.escort||[])) if(enemies.includes(e)) theirs+=P.gInf;
  return { ours, theirs }; }
function updatePosture(f, now){ if(now<f.postAt) return; f.postAt=now+0.5; const P=FORT.posture, p=S.player;
  const near = Math.hypot(p.pos.x-f.x, p.pos.z-f.z) < f.R+P.near; let want='idle';
  if(near && f.active && !f.breached){ const s=strength(f); want = s.ours >= s.theirs*P.holdK ? 'hold' : 'sally'; f.ratio=s; }
  if(want===f.posture) return; const was=f.posture; f.posture=want;
  if(want==='hold'){ for(const e of f.units) if(e.exit && e.exit.f===f && enemies.includes(e) && Math.hypot(e.pos.x-f.x, e.pos.z-f.z) < f.R-1) regarrison(f, e);
    f.openUntil=0; showBanner(f.name+' CỐ THỦ TRONG THÀNH — CỔNG VẪN MỞ, XÔNG VÀO!', '#ffb35a'); radio(f.chief+': "Anh em giữ thành! Bắn! Đừng để thằng lính đó lọt qua cổng!"', 'f_rally_2'); }   // (Z315 for a soldier the gate stays open)
  else if(want==='sally'){ f.sortieAt=now+1.2; showBanner(f.name+' MỞ CỔNG XUẤT QUÂN!', '#ff6a4a'); radio(f.chief+': "Không ai được lùi! Tất cả, tiến lên!"', 'f_rally_3'); }
  else if(was==='hold') f.sallyAt=Math.max(f.sallyAt, now+4); }
// SALLY posture: the garrison itself pours out in waves (the commander and his guard stay home)
function sortie(f, now){ if(now<(f.sortieAt||0)) return; const P=FORT.posture; f.sortieAt=now+R2(P.every);
  let nI=0; for(const e of f.units){ if(!enemies.includes(e) || e.exit || e.commander || e.escortOf) continue; if(Math.hypot(e.pos.x-f.x, e.pos.z-f.z) > f.R-0.5) continue;
    if(e.def.inf && nI<P.waveInf){ fortSendOut(f, e, now); nI++; } } }
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
function refill(f){ const live=f.units.filter(e=>enemies.includes(e)); f.units=live; let nI=0; for(const e of live) if(e.def.inf) nI++;
  const capI=MOBILE?FORT.liveInfMobile:FORT.liveInf;
  if(nI<=capI-3 && f.pool.inf>0 && f.hatches && f.hatches.length){ const h=f.hatches[(Math.random()*f.hatches.length)|0], n=Math.min(f.pool.inf, 3+((Math.random()*3)|0)); popHatch(h); squadAt(f, h.x, h.z, n, true); f.pool.inf-=n; }   // Z170 a whole squad comes up from the basement
  else if(nI<capI && f.pool.inf>0 && !(f.hatches && f.hatches.length)){ spawnInside(f, Math.random()<0.25?'rpg':'rifle'); f.pool.inf--; } }
// the bodyguards keep their ring round the commander (posts move with him); he falls → they fight on their own
function escortFollow(f){ if(!f.escort) return; const c=f.cmd, alive=c && enemies.includes(c);
  for(let i=f.escort.length-1;i>=0;i--){ const e=f.escort[i]; if(!enemies.includes(e)){ f.escort.splice(i,1); continue; }
    if(!alive){ e.guard=null; e.post=null; continue; } e.escA+=0.06; e.post=[c.pos.x+Math.cos(e.escA)*e.escR, c.pos.z+Math.sin(e.escA)*e.escR]; } }
// sallies: a squad marches out of the gate onto the field
function sally(f, now){ f.sallyAt=now+R2(FORT.sally)*(f.tier===3?0.8:1);
  const p=S.player; if(!p || f.posture==='hold' || f.coreDown) return;                     // Z111b a fortress that holds keeps its gate shut · Z176 no command post, no sorties
  let n=0; for(const e of enemies) if(!e.guard) n++; if(n > (MOBILE?16:26)) return;   // the field is already crowded
  const n0=enemies.length;
  if(f.pool.inf>=3){ spawnSquad({ x:f.ix, z:f.iz }); f.pool.inf-=3; } else return;
  for(let i=n0;i<enemies.length;i++) enemies[i].fortOf=f;   // Z107 sally troops belong to their fortress (they don't hold a wave open)
  fortLaunch(f, n0, now); }                                  // Z111b formed up INSIDE the gate → it swings open → they march out
// wave reinforcements come out of a fortress gate (most of the time) instead of over the fence — raised inside, then the gate opens
export function fortSpawnPoint(){ const alive=FORTS.filter(f=>!f.captured && f.g && f.posture!=='hold'); if(!alive.length || Math.random()>FORT.fromGate) return null;
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
  for(const fl of (f.towerFlags||[])) fl.material.map=vnTex(); if(f.coreFlag && !f.coreDown) f.coreFlag.material.map=vnTex();   // Z176 our colours on every tower
  for(const e of f.units) if(enemies.includes(e)) fortSendOut(f, e, now);
  if(f.bar){ freeEnemyBar(f.bar); f.bar=null; } if(!f.breached){ f.breached=true; const i=blocks.indexOf(f.gate); if(i>=0) blocks.splice(i,1); for(const L of f.leaves) L.open=0.001; }
  const L=FORT.loot;
  for(let k=0;k<L.drops+f.tier-1;k++) dropPowerup({ x:f.x+(Math.random()-0.5)*8, z:f.z+(Math.random()-0.5)*8 }, Math.min(3, f.tier));
  for(let k=0;k<L.armoury;k++) dropPowerup({ x:f.x+(Math.random()-0.5)*6, z:f.z+(Math.random()-0.5)*6 }, 2);   // Z115 the armoury
  saveProfile();
  bigExplode({x:f.x,z:f.z}, 0x9be04a, 1.6); ringPulse(new THREE.Vector3(f.x,0,f.z), 0x9be04a, 6); sfx('levelup'); celebrate('fort', f.x, f.z);   // Z140 fireworks over the taken fort
  showBanner('ĐÃ CHIẾM '+f.name+'!', '#8cbf3f');
  const left=fortsLeft(); radio(left ? ('Còn '+left+' đại bản doanh. '+(left===1 && mainFort() && !mainFort().captured ? 'Cổng '+mainFort().name+' đã mở phong toả!' : 'Tiếp tục tiến công!')) : 'Mọi đại bản doanh đã thất thủ!'); }
// the citadel falls with its commander — the stage boss (boss.js kills → stage clear)
export function fortBossDown(){ const f=mainFort(); if(f && !f.captured) capture(f, performance.now()/1000); }
// ---- per frame ----
export function updateForts(dt, now){ const p=S.player; if(!p) return; if(((now*4)|0)!==_fhT){ _fhT=(now*4)|0; updateFortHud(); }
  for(const f of FORTS){ if(!f.g) continue;
    if(f.leaves){ for(const L of f.leaves){ if(L.open){ L.open=Math.min(1, L.open+dt*1.8); L.g.rotation.y = L.s*L.open*1.45; L.g.rotation.z = L.s*L.open*0.08; } } }
    updateGate(f, dt, now);
    if(f.hitT>0){ f.hitT-=dt; f.gate && (f.gate.mesh.position.x += (Math.random()-0.5)*0.04); }
    if(f.bar && f.gate){ const k=Math.max(0, f.gate.hp/f.gate.maxHp); f.bar.g.position.set(f.gx, f.gy+FORT.wallH+3.6, f.gz); f.bar.g.quaternion.copy(camera.quaternion); f.bar.fill.scale.x=Math.max(0.001,k); f.bar.fill.position.x=-(1-k)*0.5; f.bar.fill.material.color.setHex(k>0.5?0xffcf5a:0xff6a4a); }
    if(f.rubble && p.vel){ const sp=Math.hypot(p.vel.x, p.vel.z); if(sp>2.5) for(const q of f.rubble) if((p.pos.x-q.x)**2+(p.pos.z-q.z)**2 < q.r*q.r){ S.shake=Math.max(S.shake, 0.1+Math.min(0.3, sp*0.02)); if(Math.random()<dt*4) haptic(12); break; } }   // Z170 grinding over the rubble
    if(f.hatches) animHatches(f, dt, now);
    if(f.coreFireUntil && now<f.coreFireUntil && Math.random()<dt*(MOBILE?6:12)){ const x=f.x+f.coreX+(Math.random()-0.5)*6, z=f.z+f.coreZ+(Math.random()-0.5)*5, y=f.gy+1.2;   // Z176 the ruins burn and smoke
      spawnPart(x, y, z, (Math.random()-0.5)*0.6, 1.5+Math.random(), (Math.random()-0.5)*0.6, {color:0x2a241e, size:2.2+Math.random()*1.5, life:2.6, smoke:true, grav:0.35, drag:0.6, op:0.45});
      if(Math.random()<0.5) spawnPart(x, y-0.4, z, 0, 1.2, 0, {color:0xffa040, color2:0xff4a10, size:0.9, grow:1.2, life:0.5, grav:1, drag:1.5}); }
    if(f.coreBc && !f.coreDown) f.coreBc.visible = ((now*1.4)%1)<0.5;   // the mast's beacon blinks
    if(f.flagFall) animFlag(f, dt);
    if(f.captured){ checkCleared(f, now); continue; }
    if(f.tier===3 && !f.duel && Math.hypot(p.pos.x-f.x, p.pos.z-f.z) < (f.Rin||f.R)+2){ f.duel=true; startBoss(now, f); }   // (no-tanks) walking in through the open gate brings the general out too
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
function tunnelAmbush(f, now){ if(UNDER.on) return;   // Z226 not while you are in the base below
  if(!f.tunnelAt){ f.tunnelAt=now+1.6+Math.random()*2.4; return; } if(now<f.tunnelAt) return;
  f.tunnel--; f.tunnelAt=0; f.tunnelWait=now+2; const p=S.player, nS=2+((Math.random()*2)|0);
  if(f.hatches && f.hatches.length){ const h=f.hatches[(Math.random()*f.hatches.length)|0]; popHatch(h); squadAt(f, h.x, h.z, nS+1, true); }
  if(p){ for(let t=0;t<24;t++){ const a=(p.facing||0)+Math.PI+(Math.random()-0.5)*2.4, d=12+Math.random()*10, x=p.pos.x+Math.sin(a)*d, z=p.pos.z+Math.cos(a)*d;   // behind or beside the tank
      if(!inField(x, z, 3) || FORTS.some(o=>Math.hypot(o.x-x,o.z-z)<o.R+2) || blocks.some(b=>Math.hypot(b.x-x,b.z-z)<b.r+2)) continue;
      const h=makeHatch(f, x, z); f.hatches.push(h); popHatch(h); bigExplode(new THREE.Vector3(x, heightAt(x,z)+0.5, z), 0x8a7a64, 0.7); squadAt(f, x, z, nS, false); break; } }
  showBanner('ĐỊCH CHUI LÊN TỪ ĐƯỜNG HẦM!', '#ff6a4a'); radio('SCH: Phục kích từ đường hầm dưới '+f.name+'! Quay nòng lại!'); }
// HUD: one line per fortress — name · gate % / sealed / garrison stirred / ours (written only when it changes)
let _fh='';
export function updateFortHud(){ const el=document.getElementById('fortHud'); if(!el) return; if(!FORTS.length){ if(_fh){ _fh=''; el.classList.add('hidden'); } return; }
  const rows=FORTS.map(f=>{ const st=f.captured?'<em class="ok">✓ ĐÃ CHIẾM</em>':f.breached?'<em class="br">THỦNG THÀNH · '+(f.cmd?'DIỆT TƯỚNG':'TƯỚNG')+'</em>':'<em>CỔNG MỞ</em>';
    return '<div class="fh-r'+(f.captured?' done':'')+(f.tier===3?' main':'')+'"><b>'+f.name+'</b>'+st+'</div>'; }).join('');
  const html='<div class="fh-t">ĐẠI BẢN DOANH · '+(FORTS.length-fortsLeft())+'/'+FORTS.length+'</div>'+rows;
  if(html!==_fh){ _fh=html; el.innerHTML=html; el.classList.remove('hidden'); } }
export function clearForts(){ { const el=document.getElementById('fortHud'); if(el){ el.classList.add('hidden'); _fh=''; } } for(const f of FORTS){ if(f.g){ unwave(f.g); scene.remove(f.g); } for(const g of f.wallGeos||[]) g.dispose(); if(f.wallMat) f.wallMat.dispose(); if(f.bar){ freeEnemyBar(f.bar); f.bar=null; } } FORTS.length=0;
  for(let i=blocks.length-1;i>=0;i--) if(blocks[i].kind==='fortwall'||blocks[i].kind==='gate') blocks.splice(i,1); }
// Z279 COLOSSAL FORTS: each battlefield's forts in their own monumental style (REALFORT: granite citadel, desert kasbah, arctic basalt-and-ice,
//   volcanic obsidian — Tripo, 4K textures). The wall sections keep their own hit points and fall one by one as before: only the instanced shape
//   changes to the model's wall, fitted to a section; every tower and the donjon become the model's tower, the gate the model's gatehouse with its
//   own doorway cut open so the game's gate leaves still swing; the procedural stonework, slits and caps are put away
// Z435 a model's meshes (under one node of a kit, or the whole file) as one geometry: each triangle carries its material's index (mi), sorted into
//   one group per material — the kit's stone has its walls in one material and its copings and merlons in another
const _ATT=['position','normal','uv','mi'];
function joinGeos(list){ const n=list.reduce((a,g)=>a+g.attributes.position.count,0), o=new THREE.BufferGeometry();
  for(const a of _ATT){ const s0=list.find(g=>g.attributes[a]); if(!s0) continue; const k=s0.attributes[a].itemSize, arr=new Float32Array(n*k); let q=0;
    for(const g of list){ const A=g.attributes[a], c=g.attributes.position.count; if(A) for(let i=0;i<c;i++) for(let j=0;j<k;j++) arr[q+i*k+j]=A.getComponent(i,j); q+=c*k; }
    o.setAttribute(a, new THREE.BufferAttribute(arr,k)); }
  return o; }
function grouped(g){ const M=g.attributes.mi; if(!M) return g; const n=g.attributes.position.count/3, ord=[...Array(n).keys()].sort((a,b)=>M.getX(a*3)-M.getX(b*3)), o=new THREE.BufferGeometry();
  for(const a of _ATT){ const A=g.attributes[a]; if(!A) continue; const k=A.itemSize, arr=new Float32Array(n*3*k); let q=0; for(const t of ord) for(let j=0;j<3;j++) for(let c=0;c<k;c++) arr[q++]=A.getComponent(t*3+j,c); o.setAttribute(a, new THREE.BufferAttribute(arr,k)); }
  let s0=0; for(let i=1;i<=n;i++) if(i===n || M.getX(ord[i]*3)!==M.getX(ord[s0]*3)){ o.addGroup(s0*3, (i-s0)*3, M.getX(ord[s0]*3)); s0=i; }
  o.computeBoundingBox(); o.computeBoundingSphere(); return o; }
const cloneMat=m=>Array.isArray(m) ? m.map(x=>x.clone()) : m.clone(), matList=m=>Array.isArray(m) ? m : [m];
function fortPiece(gl, cutDoor, slice, node){ gl.scene.updateMatrixWorld(true); const root=node ? gl.scene.getObjectByName(node) : gl.scene; if(!root) return null; const mats=[], parts=[];
  root.traverse(o=>{ if(!o.isMesh) return; let mi=mats.indexOf(o.material); if(mi<0){ mats.push(o.material); mi=mats.length-1; } let q=o.geometry.clone().applyMatrix4(o.matrixWorld); q=q.index?q.toNonIndexed():q;
    const c=new THREE.BufferGeometry(); for(const a of ['position','normal','uv']) if(q.attributes[a]) c.setAttribute(a, q.attributes[a]); c.setAttribute('mi', new THREE.BufferAttribute(new Float32Array(q.attributes.position.count).fill(mi),1)); parts.push(c); });
  if(!parts.length) return null; let g=joinGeos(parts);
  g.computeBoundingBox(); let b=g.boundingBox; g.translate(-(b.min.x+b.max.x)/2, -b.min.y, -(b.min.z+b.max.z)/2); if(b.max.z-b.min.z > b.max.x-b.min.x) g.rotateY(Math.PI/2); g.computeBoundingBox(); b=g.boundingBox;
  if(cutDoor || slice){ const P=g.attributes.position, sz=b.getSize(new THREE.Vector3()), keep=[], half=slice ? sz.y*slice/2 : 0;   // the doorway cut out of a gatehouse · or, for a wall, a slice of its own true proportions (a section's length : height)
    for(let t=0;t<P.count/3;t++){ let x=0,y=0; for(let j=0;j<3;j++){ x+=P.getX(t*3+j); y+=P.getY(t*3+j); } x/=3; y/=3; if(cutDoor && Math.abs(x)<sz.x*REALFORT.door[0] && y<sz.y*REALFORT.door[1]) continue; if(slice && Math.abs(x)>half) continue; keep.push(t); }
    const o=new THREE.BufferGeometry(); for(const a of _ATT){ const A=g.attributes[a]; if(!A) continue; const n=A.itemSize, arr=new Float32Array(keep.length*3*n); let q=0; for(const t of keep) for(let j=0;j<3;j++) for(let c=0;c<n;c++) arr[q++]=A.getComponent(t*3+j,c); o.setAttribute(a, new THREE.BufferAttribute(arr,n)); }
    g=o; g.computeBoundingBox(); b=g.boundingBox; }
  g=grouped(g); return { geo:g, mat:mats.length>1 ? mats.map(m=>m.clone()) : mats[0].clone(), size:b.getSize(new THREE.Vector3()) }; }
// Z327 the stretch of a (non-indexed) wall between x0 and x1, every triangle clipped at both ends, moved so its middle (mid) is at 0
function sliceX(g, x0, x1, mid){ const P=g.attributes.position, N=g.attributes.normal, U=g.attributes.uv, MI=g.attributes.mi, out=[], n=P.count/3;
  const vtx=i=>[P.getX(i), P.getY(i), P.getZ(i), N?N.getX(i):0, N?N.getY(i):1, N?N.getZ(i):0, U?U.getX(i):0, U?U.getY(i):0, MI?MI.getX(i):0];
  const cut=(poly, d)=>{ const o=[]; for(let i=0;i<poly.length;i++){ const A=poly[i], B=poly[(i+1)%poly.length], da=d(A), db=d(B); if(da>=0) o.push(A);
      if((da>=0)!==(db>=0)){ const t=da/(da-db); o.push(A.map((v,c)=>v+(B[c]-v)*t)); } } return o; };
  for(let t=0;t<n;t++){ const a=P.getX(3*t), b=P.getX(3*t+1), c=P.getX(3*t+2); if(Math.max(a,b,c)<=x0 || Math.min(a,b,c)>=x1) continue;
    let poly=[vtx(3*t), vtx(3*t+1), vtx(3*t+2)]; if(Math.min(a,b,c)<x0) poly=cut(poly, v=>v[0]-x0); if(Math.max(a,b,c)>x1) poly=cut(poly, v=>x1-v[0]);
    for(let k=1;k+1<poly.length;k++) out.push(poly[0], poly[k], poly[k+1]); }
  const o=new THREE.BufferGeometry(), pos=new Float32Array(out.length*3), nor=new Float32Array(out.length*3), uv=new Float32Array(out.length*2), mi=new Float32Array(out.length);
  out.forEach((v,i)=>{ mi[i]=Math.round(v[8]); pos[3*i]=v[0]-mid; pos[3*i+1]=v[1]; pos[3*i+2]=v[2]; const l=Math.hypot(v[3],v[4],v[5])||1; nor[3*i]=v[3]/l; nor[3*i+1]=v[4]/l; nor[3*i+2]=v[5]/l; uv[2*i]=v[6]; uv[2*i+1]=v[7]; });
  o.setAttribute('position', new THREE.BufferAttribute(pos,3)); if(N) o.setAttribute('normal', new THREE.BufferAttribute(nor,3)); if(U) o.setAttribute('uv', new THREE.BufferAttribute(uv,2)); if(MI) o.setAttribute('mi', new THREE.BufferAttribute(mi,1));
  o.computeBoundingBox(); o.computeBoundingSphere(); return MI ? grouped(o) : o; }
// Z378 the face a cut through the wall shows at x = xc: the model's cross-section there (where its triangles cross the plane), filled row by row between the
//   outline's crossings (pairs of them: a parapet, the walk, the other parapet), facing dir along x, moved by -mid like its slice; the same attributes as like
function cutFace(g, xc, dir, mid, like, fm){ const P=g.attributes.position, n=P.count/3, seg=[], B=FORT_GAP.bin; let y0=Infinity, y1=-Infinity;
  for(let t=0;t<n;t++){ const q=[]; for(let j=0;j<3;j++){ const a=3*t+j, b=3*t+(j+1)%3, xa=P.getX(a)-xc, xb=P.getX(b)-xc; if((xa<0)===(xb<0)) continue; const u=xa/(xa-xb);
      q.push([P.getY(a)+(P.getY(b)-P.getY(a))*u, P.getZ(a)+(P.getZ(b)-P.getZ(a))*u]); }
    if(q.length===2){ seg.push(q); y0=Math.min(y0, q[0][0], q[1][0]); y1=Math.max(y1, q[0][0], q[1][0]); } }
  if(!seg.length || !(y1-y0>0.5)) return null; const pos=[], x=xc-mid;
  const quad=(ya, yb, za, zb)=>{ const v=[[ya,za],[ya,zb],[yb,zb],[yb,za]];
    for(const [i,j,k] of [[0,1,2],[0,2,3]]){ let A=v[i], Bv=v[j], Cv=v[k]; if(Math.sign((Bv[0]-A[0])*(Cv[1]-A[1])-(Bv[1]-A[1])*(Cv[0]-A[0]))!==dir) [Bv,Cv]=[Cv,Bv];   // (its normal's x the way it faces)
      for(const w of [A,Bv,Cv]) pos.push(x, w[0], w[1]); } };
  for(let y=y0; y<y1; y+=B){ const yc=y+B/2, zs=[]; for(const [a,b] of seg) if((a[0]-yc)*(b[0]-yc)<0) zs.push(a[1]+(b[1]-a[1])*(yc-a[0])/(b[0]-a[0])); if(zs.length<2) continue; zs.sort((a,b)=>a-b);
    const yb=Math.min(y+B, y1); if(zs.length%2) quad(y, yb, zs[0], zs[zs.length-1]); else for(let i=0;i<zs.length;i+=2) if(zs[i+1]-zs[i]>0.02) quad(y, yb, zs[i], zs[i+1]); }
  if(!pos.length) return null; const o=new THREE.BufferGeometry(), m=pos.length/3; o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if(like.attributes.normal){ const nr=new Float32Array(m*3); for(let i=0;i<m;i++) nr[3*i]=dir; o.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); }
  if(like.attributes.uv){ const uv=new Float32Array(m*2); for(let i=0;i<m;i++){ uv[2*i]=pos[3*i+2]/4; uv[2*i+1]=pos[3*i+1]/4; } o.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }   // (the fort's own stone, 4 m a tile)
  o.setAttribute('mi', new THREE.BufferAttribute(new Float32Array(m).fill(fm||0), 1)); return o; }
// Z435 a land's stone (or steel) for the kit's wall faces: its photo material, loaded once per land, repeated over the kit's ~12 m tile; the kit's own
//   cut-stone copings and merlons keep their maps and take the land's tint
const KITMAP={};
function kitMaps(st){ if(KITMAP[st]) return KITMAP[st]; const L=new THREE.TextureLoader(), d='assets/models/real/fortkit/'+st+'/', SY=REALFORT.kit.style[st]||{}, r=SY.rep||6;
  const t=(f, srgb)=>L.loadAsync(d+f).then(x=>{ x.wrapS=x.wrapT=THREE.RepeatWrapping; x.repeat.set(r, r); x.anisotropy=MOBILE?4:8; x.colorSpace=srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return x; }).catch(()=>null);
  return (KITMAP[st]=Promise.all([t('diff.jpg', true), t('nor.jpg', false), t('arm.jpg', false)]).then(([map, nor, arm])=>map ? { map, nor, arm } : null)); }
function kitStone(m, SY, mp, KT){ m.envMapIntensity=KT.env; m.side=THREE.FrontSide; const wall=/wall/.test(m.name);
  if(mp && (wall || SY.metal)){ const k=wall ? 1 : SY.trimRep || 0.25, tx=t=>{ if(!t || k===1) return t; const c=t.clone(); c.repeat.multiplyScalar(k); c.needsUpdate=true; return c; };   // (steel all over: its copings in the plate too, at the trim's own tile)
    m.map=tx(mp.map); if(mp.nor) m.normalMap=tx(mp.nor); if(mp.arm){ const a=tx(mp.arm); m.roughnessMap=a; m.metalnessMap=a; } m.metalness=SY.metal ? SY.metal : 0; m.roughness=1; m.color.setRGB(...(SY.tint || [1, 1, 1])); }
  else m.color.setRGB(...(SY.trim || [1, 1, 1]));
  m.needsUpdate=true; }
// Z453 AN OPEN CITADEL (FORTHILL open): no ring of wall round the capital — only the curtain along its cliff behind stands (keepArc either side of the
//   rear), its towers at the ends; the front walls, the gate's leaves and the wall-walk riflemen over them are gone (the gatehouse stands, its arch open): men and tanks come up the road onto the yard and the ward
function openCitadel(f){ const ga=f.hillGa ?? Math.atan2(f.gz-f.z, f.gx-f.x), keep=hillCfg().keepArc, front=(x,z)=>Math.PI-Math.abs(Math.atan2(Math.sin(Math.atan2(z,x)-ga), Math.cos(Math.atan2(z,x)-ga)))>=keep;
  _m.makeScale(0,0,0); for(const pc of f.pieces){ if(!front(pc.cx, pc.cz)) continue; const i=blocks.indexOf(pc.block); if(i>=0) blocks.splice(i,1); pc.down=true; for(const im of [f.wallIM, f.capIM, f.darkIM]) if(im){ im.setMatrixAt(pc.i,_m); im.instanceMatrix.needsUpdate=true; } }
  if(f.pt) for(const gd of f.pt.guards){ const P=gd.g.position; if(front(P.x, P.z)){ gd.alive=false; gd.g.visible=false; } }
  { const i=blocks.indexOf(f.gate); if(i>=0) blocks.splice(i,1); } if(f.leaves && f.leaves[0] && f.leaves[0].g.parent) f.leaves[0].g.parent.visible=false; f.breached=true; f.openCitadel=true;
  if(f.gp){ const gw=(FORT.gateW+2*(f.gp[4]||5))*REALFORT.gateW, of=Math.atan2(f.gux, f.guz);   // Z453 the gatehouse stays, open: the road runs through its arch — its two piers are solid
    for(const sd of [-1,1]){ const o=sd*(gw/2+FORT.gateW/2)/2; blocks.push({ mesh:new THREE.Object3D(), x:f.gx+f.gux*o, z:f.gz+f.guz*o, r:3.2, obb:{ f:of, hl:(gw-FORT.gateW)/4, hw:3.2 }, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'gatepier', fort:f }); } } }
// Z458 a keep toned to its land: each level its own copy of that level's material, toned (a baked level's atlas is not the near scan's — one shared
//   material, as scenePiece's tone gives, painted the near maps on the mid level's UVs: camouflage blotches from 40 m on)
function toneLevel(m, tone){ m.traverse(o=>{ if(!o.isMesh || !o.material || o.material.userData.toned) return; const s=o.material, c=s.clone(); c.onBeforeCompile=s.onBeforeCompile; c.customProgramCacheKey=s.customProgramCacheKey; c.color.multiply(tone); c.userData.toned=true; o.material=c; }); }
function realFort(){ return !!REALFORT.biomes[BIOME.name] && typeof window!=='undefined' && !/procfort/.test(location.search+location.hash); }   // Z434 this battlefield's forts wear real walls and towers
function dressFort(f, stone){ const LK=f.look, st=(LK && LK.st) || REALFORT.biomes[BIOME.name]; if(!st || typeof window==='undefined' || /procfort/.test(location.search+location.hash)) return;
  const K0=REALFORT.kit && REALFORT.kit.on ? REALFORT.kit : null, SY0=K0 && K0.style[st], SY=SY0 && LK ? { ...SY0, ...(LK.arch ? { arch:LK.arch } : {}), ...(LK.tint ? { tint:LK.tint } : {}), ...(LK.trim ? { trim:LK.trim } : {}) } : SY0, A=SY && K0.arch[SY.arch], KT=A ? { ...K0, ...A, towerW:A.towerW || K0.towerW } : null;   // Z435 the photographed kit: this land's architecture and stone
  (KT ? Promise.all([loadGLTF(KT.key), kitMaps(st)]).then(([gl, mp])=>[gl, gl, gl, mp]) : Promise.all(['wall','tower','gate'].map(p=>loadGLTF('fort_'+st+'_'+p)))).then(([wg,tg,gg,mp])=>{ const host=f.wallIM && f.wallIM.parent; if(!wg || !tg || !FORTS.includes(f) || !host) return;
    const C=REALFORT, H=FORT.wallH, TH=FORT.wallT, W=fortPiece(wg, false, 0, KT && KT.wall), T=fortPiece(tg, false, 0, KT && KT.tower), Gt=gg && f.gp ? fortPiece(gg, !KT, 0, KT && KT.gate) : null;
    const HC=KT && f.hillH ? hillCfg() : null, T2=HC && HC.mix ? fortPiece(tg, false, 0, HC.mix) : null, TK=HC && HC.keep ? fortPiece(tg, false, 0, HC.keep) : null, bury=HC ? HC.bury||0 : 0;   // Z453 a crag's castle: round towers and square bastions in turn, a square keep, every foot let into the rock
    if(!W || !T) return; if(KT) for(const P of [W, T, Gt, T2, TK]) if(P) for(const m of matList(P.mat)) kitStone(m, SY, mp, KT);
    const add=(geo,mat,x,z,ry,sx,sy,sz)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,-0.4,z); m.rotation.y=ry; m.scale.set(sx,sy,sz); m.castShadow=m.receiveShadow=true; host.add(m); return farLOD(m); };   // Z328 light copies far away
    // the architecture (baked meshes straight under the fort's group) goes; groups (gate leaves, guards, guns, flags) and the wall sections stay
    for(const o of host.children.slice()) if(o.isMesh && !o.isInstancedMesh && !o.userData.outpost) o.visible=false; for(const m of [f.darkIM, f.capIM]) if(m) m.visible=false;
    { const hh=H+2+C.wallUp, k=hh/W.size.y, len=W.size.x*k, rep=Math.max(1, Math.round(len/FORT.seg)), g=W.geo.clone(); g.scale(rep*FORT.seg/W.size.x, k, TH*C.thick/W.size.z); g.translate(0,-1,0);
      // the wall at its true proportions spans rep sections; each section shows its own stretch of it
      // Z327 cut once at load (its triangles clipped at the stretch's ends), one instanced mesh per stretch, culled to the view and the shadow's reach — it
      //   used to draw the whole wall for every 3 m section and throw 7/8 of it away pixel by pixel: ~4M triangles a frame, twice (the shadow), for 4 forts
      const mat=cloneMat(W.mat); f.wallMat=mat; f.wallSl=[]; f.wallGeos=[]; f.wallIM.visible=false; f.wallHW=TH*C.thick/2+0.05;   // Z413 its collider as thick as this stone (world/solid-shape.js)
      // Z378 where the model's ragged end meets its own start (between stretch rep-1 and stretch 0) it left a see-through slit 0.3–1.5 m wide that nobody
      //   could pass: inside a run of wall it is opened into a clean breach FORT_GAP.w wide — both stretches cut back from it, their cut faces filled — and the
      //   two sections' colliders end where the stone does (pc.cut0 / cut1, world/solid-shape.js: for the soldier and his ride, never a tank)
      const G=FORT_GAP, open=!KT && rep>=G.minRep, half=G.w/2;   // (Z435 the kit's wall tiles cleanly: no seam to open)
      for(let s=0;s<rep;s++){ const cx=(s-(rep-1)/2)*FORT.seg, all=f.pieces.filter(pc=>pc.i%rep===s); if(!all.length) continue;
        for(const v of [0,1,2]){ const list=all.filter(pc=>(open && s===0 && pc.prev ? 1 : open && s===rep-1 && pc.next ? 2 : 0)===v); if(!list.length) continue;   // whole · cut at its start · cut at its end
          const x0=cx-FORT.seg/2-0.02+(v===1?half:0), x1=cx+FORT.seg/2+0.02-(v===2?half:0); let sg=sliceX(g, x0, x1, cx), mt=mat;
          const face=v ? cutFace(g, v===1?x0:x1, v===1?-1:1, cx, sg, matList(mat).length) : null; if(face){ const mg=grouped(joinGeos([sg, face])); sg.dispose(); face.dispose(); sg=mg; mt=[...matList(mat), f.wallIM.material]; }
          const im=new THREE.InstancedMesh(sg, mt, list.length); f.wallGeos.push(sg);
          list.forEach((pc,j)=>{ f.wallIM.getMatrixAt(pc.i,_m); im.setMatrixAt(j,_m); f.wallSl[pc.i]=[im,j]; const sx=pc.pl/FORT.seg+0.02; if(v===1) pc.cut0=half*sx-0.03; if(v===2) pc.cut1=half*sx-0.03; });
          im.instanceMatrix.needsUpdate=true; im.computeBoundingSphere(); im.castShadow=im.receiveShadow=true; host.add(im); } }
      g.dispose();
      // a wall-top rifleman left standing over a breach steps along to the stone beside it
      for(const pc of f.pieces) if(pc.cut0 && f.pt) for(const gd of f.pt.guards){ const P=gd.g.position, sx=pc.cx-pc.ux*pc.pl/2, sz=pc.cz-pc.uz*pc.pl/2, al=(P.x-sx)*pc.ux+(P.z-sz)*pc.uz, ac=(P.x-sx)*pc.uz-(P.z-sz)*pc.ux;
        if(Math.abs(al)<half+G.guard && Math.abs(ac)<TH){ const to=(al<0?-1:1)*(half+G.guard)-al; P.x+=pc.ux*to; P.z+=pc.uz*to; } } }
    // a tower at every corner and at both ends of each run of wall (the gate's sides included), the gatehouse over the gate
    const gw=Gt ? (FORT.gateW+2*(f.gp[4]||5))*C.gateW : 0, TH2=H+C.towerUp, KY=KT ? (H+2+C.wallUp+KT.towerUp)/T.size.y : 0, KX=KT ? Math.max(KT.towerW/Math.max(T.size.x,T.size.z), KY*KT.squash) : 0, TW=KT ? KX*Math.max(T.size.x,T.size.z) : FORT.arch.flankW*C.towerW, pts=[];   // (Z435 the kit's round tower: never squeezed thinner than squash × its own proportions)
    for(const pc of f.pieces||[]){ if(pc.down) continue; for(const [end,sg] of [[pc.prev,-1],[pc.next,1]]) if(!end || end.down) pts.push([pc.cx+pc.ux*sg*pc.pl/2, pc.cz+pc.uz*sg*pc.pl/2, pc.ry]); }
    const put=[]; let ti=0; for(const [x,z,ry] of pts){ if(put.some(([a,b])=>Math.hypot(a-x,b-z)<TW*0.8)) continue; if(Gt && Math.hypot(x-f.gp[0], z-f.gp[1]) < gw*0.55) continue; put.push([x,z]);
      if(KT){ const P2=T2 && (ti++)%2 ? T2 : T, ky=P2===T ? KY : (H+2+C.wallUp+KT.towerUp+bury)/P2.size.y, kx=P2===T ? KX : Math.max(KT.towerW*0.85/Math.max(P2.size.x,P2.size.z), ky*KT.squash); add(P2.geo, P2.mat, x, z, ry, kx, ky*(1+bury/(P2.size.y*ky)), kx).position.y-=bury; continue; } const k=TW/Math.max(T.size.x,T.size.z); add(T.geo, T.mat, x, z, ry, k, TH2/T.size.y, k); }
    if(f.lk){ const [x,z,ry,s,wh]=f.lk, k=LK.keep, tc=LK.tone && new THREE.Color().setRGB(...LK.tone), lod=scenePiece(k, s, { shadow:true, ...(tc ? { onLevel:(lv, m)=>toneLevel(m, tc) } : {}) }); lod.position.set(x, -0.4+wh-sceneDims(k, s).y*(SCENERY.models[k].sink||0), z); lod.rotation.y=ry; lod.scale.setScalar(s); host.add(lod); }   // Z457 the look's castle where the keep goes
    else if(f.dj && KT){ const KP=TK||T, [x,z,ry,w]=f.dj, k=Math.max(w*KT.keepW/Math.max(KP.size.x,KP.size.z)*(TK ? 0.75 : 1), KY*KT.keepH), wh=f.ward ? f.ward.h : 0, top=-0.4+KP.size.y*k+wh; add(KP.geo, KP.mat, x, z, ry, k, k, k).position.y+=wh;   // Z435 the keep: the round tower whole, broad and squat, not a 40 m spire
      f.keepY=top; if(f.flagG) f.flagG.position.y=top; if(f.label) f.label.position.y=top+(f.flagH||12)+3; }
    else if(f.dj){ const [x,z,ry,w,h]=f.dj, k=w*C.keepW/Math.max(T.size.x,T.size.z); add(T.geo, T.mat, x, z, ry, k, (h+C.towerUp)*C.keepH/T.size.y, k); }
    if(Gt && f.openCitadel && (TK||T2)){ const P2=TK||T2, [x,z,ry]=f.gp, ky=(H+2+C.wallUp+KT.towerUp+bury)/P2.size.y, kx=Math.max(KT.towerW*0.85/Math.max(P2.size.x,P2.size.z), ky*KT.squash);   // Z453 an open citadel's gate: two square towers either side of the road, no arch standing alone
      for(const sd of [-1,1]){ const o=sd*(gw/2+FORT.gateW/2)/2; add(P2.geo, P2.mat, x+f.gux*o, z+f.guz*o, ry, kx, ky*(1+bury/(P2.size.y*ky)), kx).position.y-=bury; } }
    else if(Gt){ const [x,z,ry,GH]=f.gp, kx=gw/Gt.size.x; add(Gt.geo, Gt.mat, x, z, ry, kx, Math.max(GH, TH2)/Gt.size.y, kx); } }); }
