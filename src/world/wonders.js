// world/wonders.js — Z144 WORLD LANDMARKS: every battlefield is set somewhere you recognise. A famous-architecture landmark stands on the high ground
//   just beyond the fence (seen from the field and in the opening tour): the Giza pyramids, Djenné's mud mosque, a Russian onion-domed cathedral,
//   the Great Wall riding the ridge, Dutch windmills (sails turning), a white marble domed mausoleum, a Roman amphitheatre in ruins, Hanoi's
//   One Pillar Pagoda, an Inuit igloo camp with a lighthouse, a Saigon skyscraper, a Ruhr blast furnace. Low-poly, vertex-coloured, not targets.
import * as THREE from 'three';
import { ARENA, BIOME, MOBILE, _mergeColored, detailize, fieldR, heightAt, scene, spawnPart } from '../hub.js';

export const WONDER = { g:null, name:'', x:0, z:0, spin:[], smoke:[], at:0 };
const P=[]; const add=(geo,x,y,z,col,ry)=>{ if(ry) geo.rotateY(ry); geo.translate(x,y,z); P.push({ geo, col }); };
const B=(w,h,d,x,y,z,col,ry)=>add(new THREE.BoxGeometry(w,h,d),x,y,z,col,ry), C=(r1,r2,h,x,y,z,col,n)=>add(new THREE.CylinderGeometry(r1,r2,h,n||12),x,y,z,col);
const S=(r,x,y,z,col,sy)=>{ const g=new THREE.SphereGeometry(r,14,10); if(sy) g.scale(1,sy,1); add(g,x,y,z,col); }, K=(r,h,x,y,z,col,n,ry)=>add(new THREE.ConeGeometry(r,h,n||12),x,y,z,col,ry);
const half=(r,x,y,z,col)=>add(new THREE.SphereGeometry(r,14,8,0,6.28,0,Math.PI/2),x,y,z,col);
// Z145 a Giza pyramid as it stands today: ~1.3 m limestone courses stepping up (the casing long gone), a tone shift every few courses,
//   a ragged broken top; Khafre's keeps a cap of smooth white casing near the summit
function pyramid(x, z, s, cap){ const n=MOBILE?18:Math.round(s/1.25), st=s/n, w0=s*1.9;
  for(let k=0;k<n;k++){ const w=w0*(1-k/n), tone=[0xd2b27c,0xc8a670,0xdcbc88,0xc0a068][(k*7+(k>>2))%4]; if(w<1.4) break;
    if(cap && k>n*0.82) B(w+st*0.3, st, w+st*0.3, x, k*st+st/2, z, 0xe8d8b4);
    else B(w, st*1.02, w, x, k*st+st/2, z, tone); }
  for(let k=0;k<12;k++){ const a=Math.random()*6.28, r=s*(0.9+Math.random()*0.5); B(1.4+Math.random()*2, 0.8+Math.random(), 1.2+Math.random()*1.5, x+Math.cos(a)*r, 0.4, z+Math.sin(a)*r, 0xc8a670, Math.random()*3); } }   // tumbled casing blocks
// the Great Sphinx: a crouching lion body, forepaws stretched out, the nemes head-cloth and a weathered face, on a cut-rock bed
function sphinx(x, z){ const c=0xc8a46e, d=0xb8945e;
  B(26,1.2,12,x,0.6,z,0xb89a68);                                                                     // bedrock enclosure floor
  B(15,4.6,5.6,x-1,3.4,z,c); B(6,5.4,5.8,x-7.4,3.4,z,d);                                              // back + haunch
  { const g=new THREE.CylinderGeometry(2.9,2.9,15,12,1,false,0,Math.PI); g.rotateZ(Math.PI/2); g.rotateX(-Math.PI/2); add(g,x-1,5.6,z,c); }   // rounded spine
  for(const sd of [-1.7,1.7]){ B(8,1.4,1.8,x+9.5,1.9,z+sd,d); B(1.6,0.9,2.0,x+13.6,1.7,z+sd,c); }        // forepaws
  B(4.4,6.4,5.0,x+5.2,5.0,z,c);                                                                       // chest
  { const g=new THREE.CylinderGeometry(1.5,3.4,4.6,4); g.rotateY(Math.PI/4); g.scale(1,1,1.2); add(g,x+5.8,9.6,z,0xd4b07a); }   // nemes head-cloth
  B(2.6,3.2,2.6,x+6.6,9.4,z,c); B(0.6,1.0,1.2,x+8.0,9.2,z,d); B(1.4,1.6,1.2,x+5.6,6.9,z,d);            // face block · nose · beard stub
  B(1.0,1.2,4.0,x-8.6,2.2,z+2.8,d); }
const W = {
  DESERT:['KIM TỰ THÁP GIZA · CAIRO, AI CẬP', ()=>{ for(const [x,z,s,cap] of [[0,0,46,1],[-58,24,38,0],[-98,48,24,0]]) pyramid(x,z,s,cap);
    C(1.6,2.2,22,40,11,-12,0xc8a46e,4); K(2.0,3,40,23.5,-12,0xd8c08a,4);   // obelisk
    sphinx(30,26); }],
  SAVANNA:['ĐẠI THÁNH ĐƯỜNG ĐẤT DJENNÉ · MALI', ()=>{ B(46,11,30,0,5.5,0,0xb0704a); B(48,2,32,0,0.5,0,0xa86a42);
    for(const x of [-14,0,14]){ add(new THREE.CylinderGeometry(2.0,3.6,22,4),x,11,15.5,0xb87a50,Math.PI/4); add(new THREE.SphereGeometry(0.9,8,6),x,22.6,15.5,0xf4f0e8); }
    for(let x=-22;x<=22;x+=4){ K(1.0,3.2,x,12.6,15.2,0xb0704a,6); K(1.0,3.2,x,12.6,-15.2,0xb0704a,6); }
    for(let x=-22;x<=22;x+=2.4) for(const y of [4,7.5,10]){ const t=new THREE.CylinderGeometry(0.08,0.08,1.4,4); t.rotateX(Math.PI/2); add(t,x,y,15.7,0x6a4a2a); } }],   // toron beams sticking out
  TUNDRA:['NHÀ THỜ THÁNH BASIL · MOSKVA, NGA', ()=>{ B(30,10,22,0,5,0,0xc8483a); const domes=[[0,0,6,0xd8a830,30],[-9,-6,3.6,0x2a8a5a,22],[9,-6,3.6,0x3a6ac8,22],[-9,6,3.6,0xc83a3a,22],[9,6,3.6,0x2aa0a0,22]];
    for(const [x,z,r,col,h] of domes){ C(r*0.7,r*0.8,h-10,x,10+(h-10)/2,z,0xe8e0d0); S(r,x,h+r*0.7,z,col,1.25); K(r*0.35,r*1.4,x,h+r*2.2,z,0xd8a830,8); }
    for(let k=0;k<5;k++) for(const sd of [-1,1]) B(2,4,0.4,-12+k*6,5,sd*11.2,0x3a2a2a); }],
  HILLS:['VẠN LÝ TRƯỜNG THÀNH · BẮC KINH, TRUNG QUỐC', null],   // built along the ridge (special)
  MEADOW:['CỐI XAY GIÓ KINDERDIJK · HÀ LAN', null],             // three windmills with turning sails (special)
  CITADEL:['LĂNG TAJ MAHAL · AGRA, ẤN ĐỘ', ()=>{ B(70,3,70,0,1.5,0,0xe8e0d4); B(30,18,30,0,12,0,0xf4f0ea); for(const sx of [-1,1]) for(const sz of [-1,1]) B(6,16,6,sx*12,11,sz*12,0xf0ebe2);
    C(9,9,6,0,24,0,0xf4f0ea,24); S(11,0,33,0,0xf8f6f2,1.25); K(1.5,7,0,48,0,0xd8b040,10); for(const sx of [-1,1]) for(const sz of [-1,1]){ C(1.6,2.0,34,sx*30,20,sz*30,0xf2eee6,12); half(2.0,sx*30,37,sz*30,0xf4f0ea); half(3,sx*11,26,sz*11,0xf4f0ea); }
    B(8,12,0.5,0,9,15.3,0x3a3a3a); }],
  RUINS:['ĐẤU TRƯỜNG COLOSSEUM · ROMA, Ý', ()=>{ const RA=34, RB=28; for(let k=0;k<44;k++){ const a=k/44*6.283, x=Math.cos(a)*RA, z=Math.sin(a)*RB, broken=a>3.6 && a<5.4, tiers=broken?((k%3)+1):4;
      for(let t=0;t<tiers;t++){ const y=t*7.5; B(4.4, 1.2, 3.4, x, y+6.8, z, 0xc8b89a, -a); for(const sd of [-1.7,1.7]){ const c=Math.cos(-a), s=Math.sin(-a); B(0.9,6.2,3.4, x+sd*c, y+3.1, z-sd*s, 0xbcae90, -a); } } } }],
  VILLAGE:['CHÙA MỘT CỘT · HÀ NỘI', ()=>{ B(26,0.4,26,0,0.1,0,0x5a7a4a); B(18,0.2,18,0,0.35,0,0x3a7a96); C(1.1,1.1,6,0,3.4,0,0xa89a86,16);
    B(7,0.6,7,0,6.6,0,0x8a3a26); B(5.6,3.2,5.6,0,8.4,0,0x9a3a2a); for(let k=0;k<2;k++){ const r=new THREE.ConeGeometry(5.6-k*1.6,2.0,4); add(r,0,10.6+k*1.4,0,0x6a4a3a,Math.PI/4);
      for(const q of [[1,1],[1,-1],[-1,1],[-1,-1]]){ const c=new THREE.ConeGeometry(0.25,1.2,4); c.rotateZ(q[0]*1.1); add(c, q[0]*(4.0-k*1.1), 10.0+k*1.4, q[1]*(4.0-k*1.1), 0x6a4a3a); } } S(0.5,0,13.2,0,0xd8a830);
    for(let k=0;k<6;k++) B(1.2,0.6,4.6,-8.5+k*0.2,0.55,-6+k*2.4,0xc8b8a0); }],   // little stone path
  ARCTIC:['LÀNG LỀU TUYẾT INUIT · NUNAVUT, CANADA', ()=>{ for(const [x,z,r] of [[0,0,5],[12,6,4],[-11,8,4.4],[4,-12,3.6],[-6,-9,3.2]]){ half(r,x,0,z,0xf2f8fc); B(r*0.5,r*0.5,r*0.8,x,r*0.25,z+r*0.9,0xe0ecf4); }
    C(2.2,3.0,26,26,13,-6,0xf2f2f2,16); for(let k=0;k<4;k++) C(2.25+k*0.02,2.35+k*0.02,2.2,26,4+k*6,-6,0xc83a3a,16); C(2.4,2.4,3,26,27.5,-6,0x2a2a2a,12); K(2.6,2.4,26,30.2,-6,0xc83a3a,12); }],
  CITY:['TOÀ THÁP LANDMARK 81 · TP. HỒ CHÍ MINH', ()=>{ const tiers=[[16,40],[13,30],[10,24],[7,18],[4,12]]; let y=0; tiers.forEach(([w,h],i)=>{ B(w,h,w,0,y+h/2,0,i%2?0x7a98ac:0x6a889c); B(w+0.4,0.6,w+0.4,0,y+h,0,0xd8dce0); y+=h; });
    C(0.3,0.3,22,0,y+11,0,0xc8ccd0,6); B(26,6,26,0,3,0,0x8a9aa6); }],
  FOUNDRY:['XƯỞNG GANG VÖLKLINGEN · ĐỨC', ()=>{ C(7,9,34,0,17,0,0x4a3a32,16); C(7.4,7.4,2,0,30,0,0x8a4a2a,16); for(const [x,z] of [[18,6],[24,-6],[-16,10]]) C(1.8,2.6,46,x,23,z,0x6a5a52,12);
    B(30,14,14,-14,7,-18,0x5a4a42); for(let k=0;k<5;k++) B(1,1,26,-2+k*0.1,26-k*4,-6,0x3a3a3a); B(4,40,4,32,20,14,0x3a3a3a); B(16,2,2,32,38,14,0x3a3a3a); }],
};
function greatWall(){ const g=new THREE.Group(); const R0=a=>fieldR(a)+12, a0=-2.6, a1=-0.5, n=70, Q=[];
  for(let k=0;k<n;k++){ const a=a0+(a1-a0)*k/n, b=a0+(a1-a0)*(k+1)/n, x0=Math.cos(a)*R0(a), z0=Math.sin(a)*R0(a), x1=Math.cos(b)*R0(b), z1=Math.sin(b)*R0(b), L=Math.hypot(x1-x0,z1-z0), cx=(x0+x1)/2, cz=(z0+z1)/2, y=heightAt(cx,cz), ry=-Math.atan2(z1-z0,x1-x0);
    const w=new THREE.BoxGeometry(L+0.2, 6, 4.2); w.rotateY(ry); w.translate(cx, y+2.4, cz); Q.push({ geo:w, col:0x9a968a });
    for(const sd of [-1,1]){ const m=new THREE.BoxGeometry(L*0.4, 1.2, 0.5); m.rotateY(ry); const nx=-Math.sin(-ry)*0, c=Math.cos(ry), s=Math.sin(ry); m.translate(cx - sd*1.9*s, y+6, cz - sd*1.9*c); Q.push({ geo:m, col:0x8a867a }); }
    if(k%9===0){ const t=new THREE.BoxGeometry(7, 11, 7); t.rotateY(ry); t.translate(cx, y+4.5, cz); Q.push({ geo:t, col:0x8e8a7e }); const r=new THREE.ConeGeometry(5.4, 2.8, 4); r.rotateY(Math.PI/4+ry); r.translate(cx, y+11.4, cz); Q.push({ geo:r, col:0x5a4a3a }); } }
  const m=new THREE.Mesh(_mergeColored(Q), detailize(new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.9 }), { scale:0.22, bump:0.06, alb:0.36, foot:3, streak:0.3 })); m.castShadow=true; m.receiveShadow=true; g.add(m); return g; }
function windmills(g){ for(const [x,z] of [[0,0],[34,-14],[-30,-10]]){ const Q=[], b=(geo,xx,yy,zz,col)=>{ geo.translate(xx,yy,zz); Q.push({ geo, col }); };
    b(new THREE.CylinderGeometry(3.2,5,16,8),0,8,0,0x6a4a3a); b(new THREE.ConeGeometry(4,5,8),0,18.5,0,0x3a3a3a); b(new THREE.BoxGeometry(2,3,0.3),0,2,4.6,0xe8e0d0);
    const tower=new THREE.Mesh(_mergeColored(Q), detailize(new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.85 }), { scale:0.35, bump:0.03, alb:0.3, foot:1.5, streak:0.25 })); tower.position.set(x,heightAt(x,z),z); tower.castShadow=true; g.add(tower);
    const hub=new THREE.Group(); hub.position.set(x, heightAt(x,z)+16.5, z+3.6); g.add(hub); const S2=[]; for(let k=0;k<4;k++){ const arm=new THREE.BoxGeometry(0.5, 13, 0.3); arm.translate(0,6.5,0); arm.rotateZ(k*Math.PI/2); S2.push({ geo:arm, col:0x5a3a24 });
      const sail=new THREE.BoxGeometry(2.6, 10, 0.12); sail.translate(1.6,7.5,0); sail.rotateZ(k*Math.PI/2); S2.push({ geo:sail, col:0xf0e8d8 }); }
    const sails=new THREE.Mesh(_mergeColored(S2), new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.85, side:THREE.DoubleSide })); sails.castShadow=true; hub.add(sails); WONDER.spin.push(sails); } }
export function clearWonder(){ if(WONDER.g){ scene.remove(WONDER.g); WONDER.g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); WONDER.g=null; } WONDER.spin.length=0; WONDER.smoke.length=0; WONDER.name=''; }
export function buildWonder(){ clearWonder(); const def=W[BIOME.name]; if(!def) return; const g=new THREE.Group(); WONDER.g=g; WONDER.name=def[0]; scene.add(g);
  const a=-Math.PI/2+(Math.random()-0.5)*1.2, R=Math.min(ARENA-14, fieldR(a)+40), x=Math.cos(a)*R, z=Math.sin(a)*R;   // on the enemy side, on the high ground beyond the fence
  if(BIOME.name==='HILLS'){ g.add(greatWall()); const am=-1.55, rm=fieldR(am)+12; WONDER.x=Math.cos(am)*rm; WONDER.z=Math.sin(am)*rm; return; }
  if(BIOME.name==='MEADOW'){ const w=new THREE.Group(); w.position.set(x,0,z); w.rotation.y=-a-Math.PI/2; g.add(w); windmills(w); WONDER.x=x; WONDER.z=z; return; }
  P.length=0; def[1](); const m=new THREE.Mesh(_mergeColored(P), detailize(new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.85, metalness:0.05 }), { scale:0.25, bump:0.05, alb:0.34, foot:3, streak:0.3 })); P.length=0;
  m.castShadow=true; m.receiveShadow=true; m.position.set(x, heightAt(x,z)-0.3, z); m.rotation.y=-a-Math.PI/2; g.add(m); WONDER.x=x; WONDER.z=z;
  if(BIOME.name==='FOUNDRY'){ for(const [lx,lz] of [[18,6],[24,-6],[-16,10]]){ const v=new THREE.Vector3(lx,47,lz).applyAxisAngle(new THREE.Vector3(0,1,0), m.rotation.y); WONDER.smoke.push([x+v.x, heightAt(x,z)+v.y, z+v.z]); } } }
export function updateWonder(dt, now){ for(const s of WONDER.spin) s.rotation.z+=dt*0.6;
  if(WONDER.smoke.length && now>WONDER.at){ WONDER.at=now+(MOBILE?0.5:0.22); const q=WONDER.smoke[(Math.random()*WONDER.smoke.length)|0]; spawnPart(q[0], q[1], q[2], 1.5+Math.random(), 2.5+Math.random()*1.5, Math.random()-0.5, { color:0x3a3632, size:4+Math.random()*3, life:4, smoke:true, grav:-0.4, drag:0.4, grow:2.2, op:0.5 }); } }
