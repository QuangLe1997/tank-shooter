// world/houses.js — Z207 REAL VILLAGE HOMES: the Vietnamese countryside house, built the way it is really built — a stone plinth with a tiled
//   floor and steps, three bays (gian) behind a column veranda (hiên), lime-washed walls in faded ochre / cream / pale green / blue, a tiled roof
//   of two pitched slabs with a ridge cap and upturned ends over gable walls, panelled wooden doors with a red lacquered board above, barred
//   windows with open shutters. Variants: the classic tiled house · a poor mud-walled house under thatch · a newer two-storey house with a
//   balcony. Around each: a kitchen annex under rusty corrugated iron with a chimney, clay water jars, a haystack, firewood, a washing line,
//   a low brick yard wall with gate pillars. Every house is merged per material (5 draws) and stays indestructible cover.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { _R, _mergeColored, detailize } from '../hub.js';

const WALLS=[0xe8d8a8,0xf0e2b0,0xdcdcd0,0xbcd0c0,0xc4d2de,0xe6c890,0xd8c8b0], TILES=[0xa84a2a,0x9a3e24,0xb4562f,0x8a4a36,0xa05a3a];
const _m={}; function mat(k, col, o, extra){ return _m[k]||(_m[k]=detailize(new THREE.MeshStandardMaterial({ color:col, roughness:0.92, ...(extra||{}) }), o)); }
let _misc=null; function miscMat(){ return _misc||(_misc=detailize(new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.85, metalness:0.05 }), { scale:0.6, bump:0.015, alb:0.28, foot:0.6, streak:0.18 })); }

// parts collected per material, merged at the end
function kit(){ const K={ wall:[], roof:[], wood:[], stone:[], misc:[] };
  K.box=(k, w,h,d, x,y,z, col, rx, ry, rz)=>{ const g=new THREE.BoxGeometry(w,h,d); if(rx) g.rotateX(rx); if(rz) g.rotateZ(rz); if(ry) g.rotateY(ry); g.translate(x,y,z); k==='misc' ? K.misc.push({ geo:g, col }) : K[k].push(g); };
  K.cyl=(k, r0,r1,h,seg, x,y,z, col, axis)=>{ const g=new THREE.CylinderGeometry(r0,r1,h,seg); if(axis==='x') g.rotateZ(Math.PI/2); if(axis==='z') g.rotateX(Math.PI/2); g.translate(x,y,z); k==='misc' ? K.misc.push({ geo:g, col }) : K[k].push(g); };
  K.geo=(k, g, col)=>{ k==='misc' ? K.misc.push({ geo:g, col }) : K[k].push(g); };
  return K; }
// a shape in the (z, y) plane extruded across x (thickness t), centred on x0
function sideShape(pts, t, x0){ const s=new THREE.Shape(); s.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) s.lineTo(pts[i][0],pts[i][1]);
  const g=new THREE.ExtrudeGeometry(s,{ depth:t, bevelEnabled:false }); g.translate(0,0,-t/2); g.rotateY(-Math.PI/2); g.translate(x0,0,0); return g; }
// pitched roof: two slabs + ridge cap + upturned ridge ends + gable walls; y0 = eave-wall top, span along z = d, length along x = w
function gableRoof(K, w, d, y0, pitch, thatch){ const ov=thatch?0.75:0.5, s=d/2+ov, r=s*Math.tan(pitch), L=s/Math.cos(pitch)+0.05, th=thatch?0.4:0.13;
  for(const sd of [1,-1]){ const g=new THREE.BoxGeometry(w+(thatch?1.4:1.0), th, L); g.rotateX(sd*pitch); g.translate(0, y0+r/2-th*0.3, sd*s/2); K.roof.push(g);
    if(!thatch){ for(let k=0;k<Math.floor(w/0.5);k++){ const rib=new THREE.BoxGeometry(0.07, 0.05, L*0.98); rib.rotateX(sd*pitch); rib.translate(-w/2-0.3+k*0.5+0.25, y0+r/2+th*0.45, sd*s/2); K.roof.push(rib); } }   // tile courses
    K.box('misc', w+1.0, 0.1, 0.12, 0, y0+r/2-r/2-0.02, sd*(s-0.04), thatch?0x8a7448:0x6a3a26); }                                                    // fascia / eave line
  if(!thatch){ K.cyl('roof', 0.13,0.13, w+1.0, 8, 0, y0+r+0.06, 0, 0, 'x');                                                                         // ridge tiles
    for(const sx of [-1,1]){ const g=new THREE.BoxGeometry(0.5,0.16,0.26); g.rotateZ(sx*-0.5); g.translate(sx*(w/2+0.62), y0+r+0.22, 0); K.roof.push(g); } }   // upturned ridge ends
  else K.cyl('roof', 0.22,0.22, w+1.4, 6, 0, y0+r+0.05, 0, 0, 'x');
  const yw=Math.max(0, r-(d/2)*(r/s));
  for(const sx of [-1,1]) K.wall.push(sideShape([[-d/2,0],[d/2,0],[d/2,yw],[0,r],[-d/2,yw]], 0.28, sx*(w/2-0.14)).translate(0,y0,0));   // gable walls (hồi)
  return r; }
function panelDoor(K, x, z, w, h, open, y0){ const B=(k,a,b,c,px,py,pz,col)=>K.box(k,a,b,c,px,py+(y0||0),pz,col); B('wood', w+0.2, h+0.14, 0.12, x, h/2+0.07, z, 0);                                                // frame
  for(const sd of [-1,1]){ const lw=w/2-0.03, cx=x+sd*(lw/2+0.015); if(open && sd>0){ B('wood', 0.07, h, lw, x+w/2-0.04, h/2, z+lw/2+0.06); continue; }
    B('misc', lw, h, 0.06, cx, h/2, z+0.06, 0x6a3e22); for(const yy of [0.28,0.62]) B('misc', lw*0.7, h*0.24, 0.03, cx, h*yy, z+0.1, 0x553018); }   // leaves with raised panels
  if(open) B('misc', w/2, h, 0.04, x+w/4, h/2, z-0.05, 0x1a1410); }                                                                               // dark interior through the open leaf
function barredWindow(K, x, y, z, w, h){ K.box('wood', w+0.18, h+0.18, 0.1, x, y, z, 0); K.box('misc', w, h, 0.04, x, y, z+0.02, 0x232c30);
  for(let k=1;k<5;k++) K.cyl('misc', 0.018,0.018, h, 5, x-w/2+k*w/5, y, z+0.07, 0x3a3a38);
  for(const sd of [-1,1]){ const g=new THREE.BoxGeometry(w/2, h, 0.05); g.translate(sd*w/4,0,0); g.rotateY(-sd*0.35); g.translate(x+sd*w/2, y, z+0.06); K.wood.push(g); } }   // shutters swung open
function jar(K, x, z, s){ const p=[[0,0],[0.2,0],[0.32,0.15],[0.36,0.35],[0.3,0.55],[0.2,0.66],[0.22,0.72],[0.18,0.74]].map(([a,b])=>new THREE.Vector2(a*s,b*s)); const g=new THREE.LatheGeometry(p,10); g.translate(x,0,z); K.geo('misc', g, Math.random()<0.5?0x6a3a24:0x4a3a30); }
function yardProps(K, w, d, X){ const fz=d/2+X.yard;
  // low brick yard wall with gate pillars (gap in the middle)
  for(const sd of [-1,1]){ const L=w/2+X.side-1.3; K.box('misc', L, 0.9, 0.24, sd*(1.3+L/2), 0.45, fz, 0xa8583a); K.box('misc', L+0.06, 0.08, 0.32, sd*(1.3+L/2), 0.93, fz, 0x8a8a80);
    K.box('misc', 0.5, 1.8, 0.5, sd*1.3, 0.9, fz, 0xd8d0b8); K.box('misc', 0.62, 0.14, 0.62, sd*1.3, 1.86, fz, 0x9a9488);
    K.box('misc', 0.24, 0.9, X.yard+d*0.4, sd*(w/2+X.side), 0.45, fz-(X.yard+d*0.4)/2, 0xa8583a); }
  K.box('misc', w+X.side*2, 0.04, X.yard-0.2, 0, 0.03, d/2+X.yard/2, 0xb06a4a);                                                                    // brick yard (sân gạch)
  for(let k=0;k<2+((Math.random()*3)|0);k++) jar(K, -w/2+0.3+k*0.75, d/2+0.55, _R(1.0,1.5));
  if(Math.random()<0.7){ const hx=_R(-w/2, w/2), hz=fz-_R(1.6,2.4); K.cyl('misc', 0.9,1.0,1.1,10, hx-w*0.15, 0.55, hz, 0xc8a85a); const c=new THREE.ConeGeometry(1.0,1.2,10); c.translate(hx-w*0.15, 1.7, hz); K.geo('misc', c, 0xb8984a); K.cyl('misc', 0.04,0.04,2.8,4, hx-w*0.15, 1.4, hz, 0x5a4a30); }   // haystack on its pole
  if(Math.random()<0.7){ const wx=w/2-0.6; for(let r=0;r<3;r++) for(let k=0;k<5-r;k++) K.cyl('misc', 0.08,0.08,1.2,6, wx-0.08*(5-r)+k*0.17, 0.09+r*0.15, -d/2+0.6, 0x7a5a3a, 'x'); }   // firewood stack
  if(Math.random()<0.6){ const lz=d/2+X.yard*0.6, x0=-w/2+0.8, x1=x0+3.4; for(const x of [x0,x1]) K.cyl('misc', 0.04,0.05,2.0,5, x, 1.0, lz, 0x6a5a40);
    K.box('misc', 3.4, 0.015, 0.015, (x0+x1)/2, 1.92, lz, 0x2a2a2a); for(let k=0;k<5;k++) K.box('misc', 0.42, _R(0.4,0.7), 0.02, x0+0.4+k*0.62, 1.6, lz, [0xc83a3a,0x3a6ac8,0xe8e0c8,0x4a8a4a,0xe8b83a][(Math.random()*5)|0]); } }   // washing line
function kitchen(K, w, d){ const kx=w/2+1.45, kw=2.4, kd=3.0, kh=2.3; K.box('wall', kw, kh, kd, kx, kh/2+0.2, -d/2+kd/2, 0); K.box('stone', kw+0.2, 0.2, kd+0.2, kx, 0.1, -d/2+kd/2, 0);
  const g=new THREE.BoxGeometry(kw+0.6, 0.06, kd+0.6); g.rotateZ(-0.22); g.translate(kx, kh+0.45, -d/2+kd/2); K.misc.push({ geo:g, col:0x8a6a52 });   // rusty corrugated iron lean-to
  for(let k=0;k<12;k++){ const q=new THREE.BoxGeometry(kw+0.62, 0.04, 0.05); q.rotateZ(-0.22); q.translate(kx, kh+0.49, -d/2+kd/2-kd/2-0.25+k*(kd+0.5)/11); K.misc.push({ geo:q, col:0x6e5444 }); }
  K.box('misc', 0.5, 1.6, 0.5, kx+0.6, kh+1.0, -d/2+0.5, 0x8a7a6a); K.box('misc', 0.6, 0.1, 0.6, kx+0.6, kh+1.85, -d/2+0.5, 0x5a5048);           // brick chimney
  K.box('misc', 0.9, 1.7, 0.06, kx-0.3, 0.95, -d/2+kd+0.01, 0x2a2420); }                                                                           // open doorway

// ---------- the three house kinds ----------
function classic(K, X){ const w=_R(7.6,9.4), d=_R(5.4,6.4), H=3.1, P=0.45, ver=1.7;
  K.box('stone', w+0.5, P, d+0.5, 0, P/2, 0); K.box('misc', w+0.36, 0.05, d+0.36, 0, P+0.02, 0, 0xa8573a);                                         // plinth + tiled floor
  for(let k=0;k<2;k++) K.box('stone', 2.0, P*(1-k*0.5), 0.4, 0, P*(1-k*0.5)/2, d/2+0.45+k*0.4);                                                   // steps
  const bz=-ver/2, bd=d-ver; K.box('wall', w, H, bd, 0, P+H/2, bz); for(const sx of [-1,1]) K.box('wall', 0.28, H, ver, sx*(w/2-0.14), P+H/2, d/2-ver/2);   // body + veranda end walls
  K.box('misc', w+0.02, 0.4, d+0.02, 0, P+0.2, 0, 0x8a8478);                                                                                       // damp-stained skirting
  const fz=d/2-ver+0.06;
  for(const cx of [-w/6, w/6]){ K.cyl('wood', 0.13,0.14, H, 10, cx, P+H/2, d/2-0.25); K.box('stone', 0.36, 0.22, 0.36, cx, P+0.11, d/2-0.25); }      // veranda columns on stone bases
  K.box('wood', w-0.3, 0.2, 0.2, 0, P+H-0.1, d/2-0.25);                                                                                            // beam
  panelDoor(K, 0, fz, 1.5, 2.25, Math.random()<0.5, P);
  K.box('misc', 1.3, 0.34, 0.05, 0, P+2.65, fz+0.04, 0xa8201a); K.box('misc', 1.1, 0.14, 0.02, 0, P+2.65, fz+0.07, 0xd8b040);                        // lacquered board (hoành phi)
  for(const sx of [-1,1]) barredWindow(K, sx*w/3, P+1.55, fz, 1.1, 1.15);
  const r=gableRoof(K, w, d, P+H, 0.5, false); X.top=P+H+r; return { w, d }; }
function thatched(K, X){ const w=_R(6.2,7.4), d=_R(4.6,5.2), H=2.5, P=0.25;
  K.box('stone', w+0.4, P, d+0.4, 0, P/2, 0); K.box('wall', w, H, d, 0, P+H/2, 0);
  for(let k=0;k<Math.floor(w/1.2);k++) K.cyl('wood', 0.07,0.08, H, 6, -w/2+0.4+k*1.2, P+H/2, d/2+0.02);                                               // bamboo posts in the mud wall
  K.box('wood', w, 0.12, 0.12, 0, P+H-0.06, d/2+0.04);
  panelDoor(K, 0, d/2+0.02, 1.1, 1.9, true, P); barredWindow(K, -w/3, P+1.3, d/2+0.02, 0.9, 0.8);
  const r=gableRoof(K, w, d, P+H, 0.72, true); X.top=P+H+r; return { w, d }; }
function twoStorey(K, X){ const w=_R(6.0,7.2), d=_R(7.6,9.0), F=3.2, P=0.35;
  K.box('stone', w+0.4, P, d+0.4, 0, P/2, 0); K.box('wall', w, F*2, d-1.2, 0, P+F, -0.6);
  K.box('misc', w+0.3, 0.18, 1.5, 0, P+F, d/2-0.6, 0xd0ccc0);                                                                                     // balcony slab over the porch
  for(const sx of [-1,1]) K.cyl('misc', 0.14,0.14, F, 10, sx*(w/2-0.35), P+F/2, d/2-0.25, 0xe8e4d8);
  for(let k=0;k<Math.floor(w/0.28);k++) K.cyl('misc', 0.035,0.045, 0.85, 6, -w/2+0.25+k*0.28, P+F+0.52, d/2+0.06, 0xe8e4d8);                        // balustrade
  K.box('misc', w+0.3, 0.1, 0.16, 0, P+F+0.98, d/2+0.06, 0xd8d4c8);
  const fz=d/2-1.2+0.06; panelDoor(K, 0, fz, 1.6, 2.3, false, P);
  K.box('misc', 2.2, 2.3, 0.05, 0, P+F+1.35, fz+0.01, 0x24323c); for(const sx of [-1,0,1]) K.box('misc', 0.08, 2.3, 0.08, sx*1.1, P+F+1.35, fz+0.04, 0xf0f0ea);   // glazed doors upstairs
  for(const sx of [-1,1]) barredWindow(K, sx*(w/2-1.0), P+1.6, fz, 0.9, 1.1);
  K.box('misc', 0.8, 0.5, 0.35, w/2-0.8, P+F*2-0.6, fz+0.2, 0xd8d8d0);                                                                             // AC unit
  const r=gableRoof(K, w, d, P+F*2, 0.42, false); X.top=P+F*2+r; return { w, d }; }

export function villageHouse(){ const K=kit(), X={ yard:_R(3.5,5), side:_R(0.8,1.6) }, kind=Math.random(), wallCol=WALLS[(Math.random()*WALLS.length)|0];
  const thatch=kind<0.16, dims=thatch ? thatched(K,X) : kind<0.34 ? twoStorey(K,X) : classic(K,X);
  if(!thatch && Math.random()<0.6) kitchen(K, dims.w, dims.d);
  if(Math.random()<0.85) yardProps(K, dims.w, dims.d, X);
  const g=new THREE.Group(), wk='w'+(thatch?'mud':wallCol), rk='r'+(thatch?'th':TILES[(Math.random()*TILES.length)|0]);
  const M={ wall: thatch ? mat(wk, 0xa88a62, { scale:0.4, bump:0.04, alb:0.4, foot:1.2, streak:0.3 }) : mat(wk, wallCol, { scale:0.5, bump:0.02, alb:0.36, foot:1.1, streak:0.42 }),
    roof: thatch ? mat(rk, 0xa89058, { scale:0.3, bump:0.06, alb:0.45, foot:0, streak:0.2 }) : mat(rk, +rk.slice(1), { scale:0.9, bump:0.03, alb:0.32, foot:0, streak:0.2, tiles:1 }),
    wood: mat('wood', 0x5a3a22, { scale:0.6, bump:0.02, alb:0.3, foot:0.3, streak:0.1 }), stone: mat('stone', 0x8e8a80, { scale:0.5, bump:0.04, alb:0.35, foot:0.8, streak:0.1 }) };
  for(const k of ['wall','roof','wood','stone']){ if(!K[k].length) continue; const geo=mergeGeometries(K[k].map(q=>{ const n=q.index?q.toNonIndexed():q; for(const a of Object.keys(n.attributes)) if(a!=='position'&&a!=='normal'&&a!=='uv') n.deleteAttribute(a); return n; }), false);
    const m=new THREE.Mesh(geo, M[k]); m.castShadow=true; m.receiveShadow=true; g.add(m); }
  if(K.misc.length){ const m=new THREE.Mesh(_mergeColored(K.misc), miscMat()); m.castShadow=true; m.receiveShadow=true; g.add(m); }
  g.userData={ w:dims.w, d:dims.d, top:X.top }; return g; }
