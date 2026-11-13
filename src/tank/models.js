// tank/models.js — Z155 TANK COLLECTION: real main battle tanks (named and shaped after the vehicles, public specs) + three of our own designs.
//   Each model = a SPEC for the shared builder (hull length / width / height, road wheels, turret silhouette, gun length, armour kits, camo)
//   + a DRESS pass for the parts that make it recognisable (Relikt ERA, arrowhead wedges, Trophy radars, ball-and-chain curtain, unmanned turret…)
//   + STATS that change how it fights when you drive it (armour → HP, engine → top speed / acceleration, suspension → turning, size → how big a target you are).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { panelTex } from '../hub.js';

// ---- turret silhouettes (top view, x = width, z = forward) extruded up; 'dome' is a flattened cast hemisphere ----
const TPOLY = {
  box:      { h:0.50, p:[[-1.02,-1.45],[1.02,-1.45],[1.08,-1.0],[1.08,0.55],[0.98,1.12],[-0.98,1.12],[-1.08,0.55],[-1.08,-1.0]] },                      // Abrams / Challenger: flat slab sides, big bustle
  wedgeLo:  { h:0.46, p:[[-0.92,-1.2],[0.92,-1.2],[1.0,-0.9],[1.02,0.5],[0.72,1.2],[-0.72,1.2],[-1.02,0.5],[-1.0,-0.9]] },                             // K2 / Type 99 base for the add-on wedges
  compact:  { h:0.50, p:[[-0.9,-1.55],[0.9,-1.55],[0.98,-1.1],[0.98,0.6],[0.8,1.05],[-0.8,1.05],[-0.98,0.6],[-0.98,-1.1]] },                           // Leclerc: short front, long autoloader bustle
  merkava:  { h:0.48, p:[[-0.85,-1.6],[0.85,-1.6],[1.0,-1.2],[1.0,0.1],[0.55,1.15],[0.18,1.72],[-0.18,1.72],[-0.55,1.15],[-1.0,0.1],[-1.0,-1.2]] },    // long pointed wedge
  unmanned: { h:0.60, p:[[-0.76,-0.95],[0.76,-0.95],[0.86,-0.62],[0.86,0.55],[0.56,1.0],[-0.56,1.0],[-0.86,0.55],[-0.86,-0.62]] },                      // Armata: compact remote turret
  facet:    { h:0.40, p:[[-0.82,-1.0],[0.82,-1.0],[0.96,-0.42],[0.72,0.9],[0.0,1.52],[-0.72,0.9],[-0.96,-0.42]] },                                    // our stealth light tank
  colossus: { h:0.70, p:[[-1.22,-1.62],[1.22,-1.62],[1.32,-1.1],[1.32,0.72],[0.92,1.42],[-0.92,1.42],[-1.32,0.72],[-1.32,-1.1]] },                     // our super-heavy
};
const _TG={};
export function turretGeo(style){ if(_TG[style]) return _TG[style];
  let gg;
  if(style==='dome'){ gg=new THREE.SphereGeometry(1, 28, 12, 0, Math.PI*2, 0, Math.PI/2); gg.scale(1.0, 0.44, 1.12); gg.translate(0,-0.24,-0.12); }
  else { const T=TPOLY[style], s=new THREE.Shape(); T.p.forEach((q,i)=>i?s.lineTo(q[0],q[1]):s.moveTo(q[0],q[1])); s.closePath();
    gg=new THREE.ExtrudeGeometry(s, { depth:T.h, bevelEnabled:true, bevelThickness:0.04, bevelSize:0.04, bevelSegments:2 }); gg.rotateX(Math.PI/2); gg.translate(0, T.h-0.28, 0); }
  const uv=gg.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*0.34, uv.getY(i)*0.34); uv.needsUpdate=true;
  return (_TG[style]=gg); }
export function turretRoof(style){ return style==='dome' ? 0.2 : style ? TPOLY[style].h-0.28 : 0.28; }

// ---- camouflage: painted patterns over the shared panel-seam texture (one canvas per scheme, cached) ----
const _CAMO={};
export function camoTex(id, cols, kind){ if(_CAMO[id]) return _CAMO[id]; const N=512, c=document.createElement('canvas'); c.width=c.height=N; const x=c.getContext('2d');
  const hex=n=>'#'+n.toString(16).padStart(6,'0'); let seed=id.length*977+cols[0]; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  x.fillStyle=hex(cols[0]); x.fillRect(0,0,N,N);
  if(kind==='digital'){ const P=8; for(let k=1;k<cols.length;k++){ x.fillStyle=hex(cols[k]); for(let i=0;i<140;i++){ const cx=rnd()*N, cy=rnd()*N, n=4+((rnd()*14)|0); let px=cx, py=cy; for(let j=0;j<n;j++){ x.fillRect(Math.floor(px/P)*P, Math.floor(py/P)*P, P*(1+((rnd()*3)|0)), P*(1+((rnd()*2)|0))); px+=(rnd()-0.5)*P*3; py+=(rnd()-0.5)*P*3; } } } }
  else if(kind==='blob'){ for(let k=1;k<cols.length;k++){ x.fillStyle=hex(cols[k]); for(let i=0;i<(k===cols.length-1?9:13);i++){ const cx=rnd()*N, cy=rnd()*N, r=30+rnd()*60; x.beginPath();
        for(let a=0;a<=12;a++){ const t=a/12*Math.PI*2, rr=r*(0.6+rnd()*0.7); a?x.lineTo(cx+Math.cos(t)*rr*1.6, cy+Math.sin(t)*rr):x.moveTo(cx+Math.cos(t)*rr*1.6, cy+Math.sin(t)*rr); } x.closePath(); x.fill(); } } }
  else if(kind==='stripe'){ x.fillStyle=hex(cols[1]); for(let i=-4;i<12;i++){ x.save(); x.translate(i*70,0); x.rotate(0.5); x.fillRect(0,-80,28+rnd()*18,N*1.6); x.restore(); } }
  // weathering: dust low, sun-fade high, then the plate seams / rivets of the shared panel texture multiplied on top
  const gr=x.createLinearGradient(0,0,0,N); gr.addColorStop(0,'rgba(255,250,235,0.06)'); gr.addColorStop(1,'rgba(120,100,70,0.18)'); x.fillStyle=gr; x.fillRect(0,0,N,N);
  try{ const pt=panelTex(); if(pt && pt.image){ x.globalCompositeOperation='multiply'; x.globalAlpha=0.85; x.drawImage(pt.image,0,0,N,N); } }catch(e){}
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return (_CAMO[id]=t); }

// ---- dress helpers (ctx = the builder's adders + materials) ----
const box=(c,par,w,h,d,x,y,z,mat)=>c.mk(par, new THREE.BoxGeometry(w,h,d), mat, x,y,z);
const rbox=(c,par,w,h,d,x,y,z,mat)=>c.mk(par, new RoundedBoxGeometry(w,h,d,1,Math.min(w,h,d)*0.2), mat, x,y,z);
const cyl=(c,par,r1,r2,h,x,y,z,mat,seg)=>c.mk(par, new THREE.CylinderGeometry(r1,r2,h,seg||10), mat, x,y,z);
function eraRows(c, rows, cols, z0, dz, yAt, tilt, mat, gapX){ for(let r=0;r<rows;r++) for(let k=0;k<cols;k++){ const x=(k-(cols-1)/2)*(gapX||0.4), z=z0-r*dz, e=c.B(c.G.era, mat, x, yAt(z), z); e.rotation.x=tilt; } }
function glacisERA(c, mat, rows){ eraRows(c, rows||2, 5, 1.84, 0.37, z=>1.05+(2.08-z)*0.294+0.05, 0.29, mat); }
function skirtERA(c, mat){ for(const sx of [-1,1]) for(let k=0;k<4;k++){ const e=c.B(c.G.era, mat, sx*1.57, 0.8, -1.39+k*0.925); e.scale.set(0.3,4.0,2.8); } }
function smoke(c, n, z0, y){ for(const sx of [-1,1]) for(let i=0;i<n;i++){ const s=cyl(c, c.turretG, 0.055,0.055,0.26, sx*0.92, y||0.18, z0-i*0.14, c.STEEL, 6); s.rotation.set(-0.9,0,sx*-0.5); } }
function slatCage(c, par, x0, x1, z0, z1, y0, y1){ for(let i=0;i<=8;i++){ const z=z0+(z1-z0)*i/8; for(const x of [x0,x1]) box(c,par,0.03,y1-y0,0.03,x,(y0+y1)/2,z,c.BLACK); }
  for(const y of [y0,(y0+y1)/2,y1]){ for(const x of [x0,x1]) box(c,par,0.03,0.03,z1-z0,x,y,(z0+z1)/2,c.BLACK); box(c,par,x1-x0,0.03,0.03,(x0+x1)/2,y,z0,c.BLACK); } }
function sight(c, x, y, z, s){ s=s||1; rbox(c, c.turretG, 0.3*s,0.26*s,0.32*s, x,y,z, c.dark(0x2a2b25)); box(c, c.turretG, 0.22*s,0.13*s,0.02, x,y+0.02*s,z+0.165*s, c.GLASS); }
function arrowWedges(c, len, mat){ for(const sx of [-1,1]){ const s=new THREE.Shape(); s.moveTo(0,0); s.lineTo(0.78,0); s.lineTo(0.06,len); s.closePath();   // spaced add-on armour wedges either side of the gun (Leopard 2A5+ / Type 99A)
    const gg=new THREE.ExtrudeGeometry(s,{ depth:0.44, bevelEnabled:true, bevelThickness:0.02, bevelSize:0.02, bevelSegments:1 }); gg.rotateX(Math.PI/2); gg.translate(0,0.2,0); if(sx<0) gg.scale(-1,1,1);
    const m=c.mk(c.turretG, gg, mat, sx*0.2, 0, 0.92); m.rotation.y=sx*-0.02; } }
function aps(c, kind){ if(kind==='trophy'){ for(const sx of [-1,1]){ const p=rbox(c,c.turretG,0.08,0.34,0.44, sx*1.06,0.12,0.15, c.dark(0x34362f)); p.rotation.y=sx*0.25; cyl(c,c.turretG,0.12,0.14,0.16, sx*0.86,0.36,-0.55, c.STEEL, 12); rbox(c,c.turretG,0.2,0.16,0.26, sx*0.86,0.5,-0.55, c.dark(0x2e302a)); } }
  if(kind==='afghanit'){ for(const sx of [-1,1]) for(let i=0;i<5;i++){ const t=cyl(c,c.turretG,0.06,0.06,0.32, sx*0.92,-0.08,0.55-i*0.28, c.dark(0x2b2d26), 8); t.rotation.z=Math.PI/2+sx*0.6; }
    for(const [x,z] of [[0.82,0.9],[-0.82,0.9],[0.82,-0.85],[-0.82,-0.85]]){ rbox(c,c.turretG,0.16,0.14,0.08,x,0.3,z,c.dark(0x262822)); box(c,c.turretG,0.12,0.08,0.02,x,0.31,z+Math.sign(z)*0.05,c.GLASS); } } }

// ---- the collection ----
//   stats: hp (× armour HP) · spd (× top speed) · acc (× acceleration) · turn (× hull turn rate) · size (× hull scale = how big a target)
export const TANK_MODELS = {
  lqt: { name:'LQT-1 THIẾT GIÁP VƯƠNG', origin:'LIÊN QUÂN THÉP', real:false, role:'XE TĂNG CHỦ LỰC · CÂN BẰNG', mass:'58 tấn', engine:'Diesel 1.500 mã lực',
    desc:'Xe chủ lực của Liên Quân Thép: giáp phản ứng nổ phủ mặt trước, trạm vũ khí điều khiển từ xa, mọi chỉ số cân bằng.',
    price:null, stats:{ hp:1, spd:1, acc:1, turn:1, size:1 }, spec:{}, mighty:true },
  t90m: { name:'T-90M PRORYV', origin:'NGA', real:true, role:'TĂNG CHỦ LỰC · THẤP, NHANH NHẸN', mass:'46,5 tấn', engine:'V-92S2F 1.130 mã lực',
    desc:'Tháp đúc tròn thấp phủ giáp nổ Relikt, lồng chắn phía sau tháp. Nhỏ và thấp — khó bắn trúng hơn, nhưng giáp mỏng hơn tăng phương Tây.',
    price:{ c:1500 }, stats:{ hp:0.95, spd:1.0, acc:1.05, turn:1.06, size:0.92 },
    spec:{ L:0.94, W:0.96, H:0.92, wheels:6, gap:1, turret:'dome', tl:1.0, tw:1.02, th:1, roofDy:-0.1, gun:1.0 }, camo:{ id:'ru3', kind:'blob', cols:[0x5d6a3a,0xa8966a,0x26271e] },
    dress(c){ const E=c.skin(0x55613a, 0.6); glacisERA(c, E, 3); skirtERA(c, E);
      for(let i=0;i<9;i++){ const a=-1.15+i*(2.3/8); if(Math.abs(a)<0.18) continue; const e=c.mk(c.turretG, c.G.era, E, Math.sin(a)*0.86, 0.08, Math.cos(a)*0.95); e.rotation.y=a; e.scale.set(1.1,3.2,1.2); }   // Relikt "brow" round the front arc
      for(let i=0;i<4;i++){ const e=c.mk(c.turretG, c.G.era, E, (i-1.5)*0.3, 0.2, 0.35); e.scale.set(0.85,1,1.4); }   // roof ERA
      slatCage(c, c.turretG, -0.95, 0.95, -1.45, -0.95, -0.15, 0.25); smoke(c, 4, 0.55, 0.05); sight(c, 0.5, 0.28, 0.45); sight(c, -0.45, 0.3, -0.25, 0.9); } },
  leo2a7: { name:'LEOPARD 2A7V', origin:'ĐỨC', real:true, role:'TĂNG CHỦ LỰC · GIÁP NÊM, NÒNG DÀI', mass:'66,5 tấn', engine:'MTU MB 873 · 1.500 mã lực',
    desc:'Giáp nêm mũi tên hai bên nòng L/55 dài, thân 7 bánh. Bọc giáp dày, cơ động tốt — chuẩn mực tăng NATO.',
    price:{ c:3000 }, stats:{ hp:1.15, spd:1.02, acc:1.0, turn:0.98, size:1.05 },
    spec:{ L:1.06, W:1.02, H:1.0, wheels:7, turret:'wedgeLo', tl:1.04, tw:1.04, th:1.05, gun:1.12 }, camo:{ id:'nato', kind:'blob', cols:[0x4a5838,0x5c4b33,0x1e201a] },
    dress(c){ arrowWedges(c, 0.95, c.TUR); sight(c, 0.5, 0.32, 0.55); cyl(c, c.turretG, 0.09,0.1,0.3, -0.42,0.42,-0.2, c.STEEL, 10); rbox(c, c.turretG, 0.28,0.24,0.28, -0.42,0.66,-0.2, c.dark(0x2a2b25));   // PERI-R17 panoramic periscope
      box(c, c.turretG, 0.24,0.12,0.02, -0.42,0.68,-0.06, c.GLASS); rbox(c, c.turretG, 1.7,0.3,0.6, 0,-0.02,-1.4, c.TUR); smoke(c, 4, -0.2, 0.15); } },
  abrams: { name:'M1A2 SEPv3 ABRAMS', origin:'MỸ', real:true, role:'TĂNG CHỦ LỰC · TUA-BIN, BỨT TỐC', mass:'66,8 tấn', engine:'Tua-bin khí AGT-1500 · 1.500 mã lực',
    desc:'Tháp phẳng góc cạnh, hộp bustle khổng lồ, trạm CROWS trên nóc. Động cơ tua-bin bứt tốc dữ dội, giáp composite dày.',
    price:{ c:3500 }, stats:{ hp:1.18, spd:1.06, acc:1.2, turn:0.95, size:1.08 },
    spec:{ L:1.08, W:1.05, H:0.98, wheels:7, turret:'box', tl:1.0, tw:1.06, th:0.98, gun:1.0 }, camo:{ id:'desert', kind:'blob', cols:[0xb59e72,0xc9b68b,0x9c875e] },
    dress(c){ sight(c, 0.55, 0.3, 0.7, 1.1); sight(c, -0.5, 0.42, -0.1);   // GPS doghouse + CITV
      const rw=new THREE.Group(); rw.position.set(-0.5,0.36,0.25); c.turretG.add(rw); rbox(c, rw, 0.36,0.26,0.4, 0,0.13,0, c.dark(0x34352d)); const g=cyl(c, rw, 0.035,0.04,0.95, 0.12,0.16,0.55, c.BLACK, 8); g.rotation.x=Math.PI/2;   // CROWS + M2
      for(let i=0;i<=6;i++) box(c, c.turretG, 0.03,0.3,0.03, -0.95+i*0.316, 0.12, -1.6, c.BLACK); box(c, c.turretG, 1.95,0.03,0.03, 0,0.27,-1.6, c.BLACK); for(const sx of [-1,1]) box(c, c.turretG, 0.03,0.03,0.5, sx*0.97,0.27,-1.38, c.BLACK);   // bustle rack
      rbox(c, c.turretG, 0.5,0.3,0.35, 0.95,-0.02,-0.7, c.TUR); rbox(c, c.turretG, 0.5,0.3,0.35, -0.95,-0.02,-0.7, c.TUR); smoke(c, 3, 0.3, 0.2);
      box(c, c.body, 1.9,0.04,0.6, 0,0.55,-1.5, c.BLACK); } },   // turbine exhaust grille on the rear deck
  k2: { name:'K2 BLACK PANTHER', origin:'HÀN QUỐC', real:true, role:'TĂNG CHỦ LỰC · CÔNG NGHỆ CAO, CƠ ĐỘNG', mass:'55 tấn', engine:'Doosan DV27K · 1.500 mã lực',
    desc:'Treo thuỷ khí, tháp thấp hình nêm, nạp đạn tự động, cảm biến cảnh báo radar và laser. Nhanh và linh hoạt bậc nhất.',
    price:{ c:3800 }, stats:{ hp:1.05, spd:1.12, acc:1.12, turn:1.1, size:0.98 },
    spec:{ L:1.04, W:1.0, H:0.94, wheels:7, turret:'wedgeLo', tl:1.08, tw:1.02, th:0.95, gun:1.12 }, camo:{ id:'k2', kind:'digital', cols:[0x59654e,0x3b4436,0x7c8569] },
    dress(c){ for(const sx of [-1,1]){ const cn=cyl(c, c.turretG, 0.0,0.09,0.16, sx*0.82,0.22,1.0, c.dark(0x2a2c26), 10); cn.rotation.x=Math.PI/2; }   // radar / laser warning receivers
      sight(c, 0.48, 0.24, 0.6); sight(c, -0.45, 0.32, -0.1, 0.95); rbox(c, c.turretG, 1.8,0.32,0.7, 0,-0.04,-1.45, c.TUR); smoke(c, 4, 0.1, 0.12);
      for(const sx of [-1,1]){ const p=box(c, c.turretG, 0.05,0.32,0.9, sx*1.06,-0.02,0.05, c.TUR); p.rotation.y=sx*0.08; } } },
  leclerc: { name:'LECLERC', origin:'PHÁP', real:true, role:'TĂNG CHỦ LỰC · NHẸ, NHANH NHẤT PHƯƠNG TÂY', mass:'57 tấn', engine:'Wärtsilä V8X · 1.500 mã lực',
    desc:'Tổ lái 3 người nhờ nạp đạn tự động trong bustle dài. Gọn, nhẹ, tốc độ cao — xạ thủ cơ động.',
    price:{ c:3200 }, stats:{ hp:1.0, spd:1.15, acc:1.1, turn:1.1, size:0.96 },
    spec:{ L:0.96, W:0.98, H:0.96, wheels:6, turret:'compact', tl:1.0, tw:1.0, th:1.0, gun:1.05 }, camo:{ id:'fr3', kind:'blob', cols:[0x575c3e,0x6e5a3c,0x2a2a22] },
    dress(c){ cyl(c, c.turretG, 0.08,0.09,0.36, -0.42,0.45,0.2, c.STEEL, 10); rbox(c, c.turretG, 0.34,0.26,0.32, -0.42,0.72,0.2, c.dark(0x2a2b25)); box(c, c.turretG, 0.26,0.12,0.02, -0.42,0.74,0.37, c.GLASS);   // HL-70 commander sight
      sight(c, 0.5, 0.28, 0.6); smoke(c, 5, 0.3, 0.15); for(let i=0;i<3;i++) rbox(c, c.turretG, 0.5,0.2,0.4, -0.55+i*0.55, 0.3, -1.25, c.dark(i===1?0x40402e:0x34342a)); } },
  ch3: { name:'CHALLENGER 3', origin:'ANH', real:true, role:'TĂNG CHỦ LỰC · GIÁP DÀY NHẤT', mass:'66 tấn', engine:'Perkins CV12 · 1.200 mã lực',
    desc:'Giáp Chobham thế hệ mới, tháp phẳng nặng nề, nòng trơn L/55A1. Chậm hơn, nhưng chịu đòn như một pháo đài.',
    price:{ c:4200 }, stats:{ hp:1.3, spd:0.9, acc:0.9, turn:0.92, size:1.06 },
    spec:{ L:1.06, W:1.04, H:1.02, wheels:6, turret:'box', tl:0.96, tw:1.04, th:1.05, gun:1.12 }, camo:{ id:'uk', kind:'stripe', cols:[0x4b5537,0x1f211b] },
    dress(c){ for(const sx of [-1,1]) rbox(c, c.turretG, 0.16,0.46,1.4, sx*1.13,0.0,0.15, c.TUR);   // add-on side armour modules
      sight(c, 0.55, 0.3, 0.65); sight(c, -0.5, 0.42, -0.2); rbox(c, c.turretG, 1.9,0.34,0.5, 0,0.0,-1.65, c.dark(0x34362b)); smoke(c, 5, 0.2, 0.18); glacisERA(c, c.skin(0x4b5537,0.6), 1); } },
  merkava: { name:'MERKAVA MK.4M', origin:'ISRAEL', real:true, role:'TĂNG CHỦ LỰC · ĐỘNG CƠ TRƯỚC, BẢO VỆ CHỦ ĐỘNG', mass:'65 tấn', engine:'GD883 · 1.500 mã lực',
    desc:'Động cơ đặt trước che cho tổ lái, tháp nêm dài lùi về sau, rèm xích bi chống đạn lõm, radar Trophy bắn hạ tên lửa.',
    price:{ c:4500 }, stats:{ hp:1.32, spd:0.92, acc:0.95, turn:0.94, size:1.06 },
    spec:{ L:1.08, W:1.0, H:1.0, wheels:6, turret:'merkava', tz:-0.45, tl:1.0, tw:1.0, th:1.0, gun:1.02 }, camo:{ id:'sinai', kind:'blob', cols:[0x8f8a6c,0x9a9577,0x857f62] },
    dress(c){ aps(c, 'trophy'); sight(c, 0.5, 0.28, 0.5); sight(c, -0.45, 0.32, -0.3);
      for(const sx of [-1,1]) for(let i=0;i<9;i++){ const z=-1.5+i*0.13; const ch=c.mk(c.turretG, new THREE.CylinderGeometry(0.008,0.008,0.4,4), c.BLACK, sx*0.98,-0.32,z); const b=c.mk(c.turretG, new THREE.SphereGeometry(0.045,6,4), c.STEEL, sx*0.98,-0.54,z); }   // ball-and-chain curtain
      for(let i=0;i<7;i++){ const z=-1.62; const x=-0.8+i*0.27; c.mk(c.turretG, new THREE.CylinderGeometry(0.008,0.008,0.4,4), c.BLACK, x,-0.32,z); c.mk(c.turretG, new THREE.SphereGeometry(0.045,6,4), c.STEEL, x,-0.54,z); }
      box(c, c.body, 0.9,0.5,0.05, 0,0.2,-2.06, c.dark(0x3a3a30)); } },   // rear crew door
  type99: { name:'TYPE 99A', origin:'TRUNG QUỐC', real:true, role:'TĂNG CHỦ LỰC · HOẢ LỰC 125 LY', mass:'58 tấn', engine:'Diesel 1.500 mã lực',
    desc:'Giáp nêm mũi tên, pháo nòng trơn 125 ly, hệ thống gây loá laser trên nóc. Mạnh và đều tay.',
    price:{ c:3600 }, stats:{ hp:1.1, spd:1.06, acc:1.04, turn:1.0, size:1.0 },
    spec:{ L:1.02, W:1.0, H:0.98, wheels:6, turret:'wedgeLo', tl:1.04, tw:1.04, th:1.0, gun:1.06 }, camo:{ id:'cn', kind:'digital', cols:[0x56603f,0x3c4430,0x8a8a64] },
    dress(c){ arrowWedges(c, 0.85, c.TUR); rbox(c, c.turretG, 0.3,0.22,0.3, 0.1,0.36,-0.3, c.dark(0x2b2c26)); box(c, c.turretG, 0.2,0.1,0.02, 0.1,0.37,-0.14, c.GLASS);   // laser dazzler / warning box
      sight(c, 0.52, 0.28, 0.55); sight(c, -0.45, 0.34, -0.3); rbox(c, c.turretG, 1.6,0.3,0.55, 0,-0.02,-1.35, c.TUR); smoke(c, 4, 0.1, 0.12); glacisERA(c, c.skin(0x56603f,0.6), 2); } },
  t14: { name:'T-14 ARMATA', origin:'NGA', real:true, role:'TĂNG THẾ HỆ MỚI · THÁP KHÔNG NGƯỜI', mass:'55 tấn', engine:'A-85-3A · 1.500 mã lực',
    desc:'Tổ lái ngồi trong khoang bọc giáp ở thân, tháp điều khiển từ xa. Hệ phòng vệ Afghanit, thân dài 7 bánh.',
    price:{ d:30 }, stats:{ hp:1.22, spd:1.1, acc:1.08, turn:1.02, size:1.04 },
    spec:{ L:1.12, W:1.0, H:0.98, wheels:7, turret:'unmanned', tl:1.0, tw:1.0, th:1.0, gun:1.1 }, camo:{ id:'ru-new', kind:'digital', cols:[0xa79a72,0x55603a,0x2a2b22] },
    dress(c){ aps(c, 'afghanit'); for(const sx of [-1,1]) rbox(c, c.turretG, 0.1,0.4,0.62, sx*0.95,0.04,0.15, c.dark(0x3a3c32));   // radar panels
      rbox(c, c.turretG, 0.32,0.22,0.36, -0.3,0.42,-0.4, c.dark(0x2b2c26)); box(c, c.turretG, 0.24,0.1,0.02, -0.3,0.43,-0.21, c.GLASS);
      for(const hx of [-0.5,0,0.5]) cyl(c, c.body, 0.2,0.2,0.05, hx,0.52,0.9, c.TUR, 12); glacisERA(c, c.skin(0x55603a,0.6), 2); } },
  ghost: { name:'BÓNG MA S-7', origin:'LIÊN QUÂN THÉP', real:false, role:'TĂNG NHẸ TÀNG HÌNH · SIÊU TỐC', mass:'32 tấn', engine:'Lai điện 1.800 mã lực',
    desc:'Thân vát đa diện tán xạ radar, sơn hấp thụ, dải phát sáng xanh. Nhỏ và nhanh như bóng ma — nhưng giáp mỏng.',
    price:{ c:2600 }, stats:{ hp:0.78, spd:1.3, acc:1.3, turn:1.25, size:0.86 },
    spec:{ L:0.92, W:0.94, H:0.84, wheels:5, turret:'facet', tl:1.0, tw:1.0, th:1.0, roofDy:-0.14, gun:0.98 }, camo:{ id:'ghost', kind:'digital', cols:[0x2c3034,0x22262a,0x3b4045] },
    dress(c){ const G2=new THREE.MeshStandardMaterial({ color:0x6ff0ff, emissive:0x3fd8ff, emissiveIntensity:1.6, roughness:0.3 });
      for(const sx of [-1,1]){ box(c, c.turretG, 0.02,0.03,1.4, sx*0.84,0.06,0.1, G2); box(c, c.body, 0.02,0.03,3.2, sx*1.5,0.3,0.0, G2); }
      for(const sx of [-1,1]){ const p=box(c, c.body, 0.08,0.5,3.8, sx*1.55,-0.12,0.0, c.HULL); p.rotation.z=sx*0.35; } } },   // faceted stealth skirts
  colossus: { name:'KHỔNG TƯỢNG K-8', origin:'LIÊN QUÂN THÉP', real:false, role:'SIÊU TĂNG HẠNG NẶNG · PHÁO ĐÀI DI ĐỘNG', mass:'110 tấn', engine:'Hai diesel 2 × 1.500 mã lực',
    desc:'Thân 8 bánh khổng lồ, tháp như lô cốt, giáp nổ phủ kín, hai ụ súng máy bên sườn tháp. Chậm và to — nhưng gần như bất khả xâm phạm.',
    price:{ d:40 }, stats:{ hp:1.6, spd:0.78, acc:0.8, turn:0.82, size:1.28 },
    spec:{ L:1.18, W:1.12, H:1.1, wheels:8, turret:'colossus', tl:1.0, tw:1.0, th:1.0, gun:1.15, gunR:1.25 }, camo:{ id:'colossus', kind:'stripe', cols:[0x3d4530,0x1c1e18] },
    dress(c){ const E=c.skin(0x46503a, 0.6); glacisERA(c, E, 3); skirtERA(c, E);
      for(const sx of [-1,1]){ const pod=new THREE.Group(); pod.position.set(sx*1.42,0.12,0.2); c.turretG.add(pod); rbox(c, pod, 0.36,0.36,0.7, 0,0,0, c.dark(0x2f3328));
        for(const dy of [-0.07,0.07]){ const g=cyl(c, pod, 0.03,0.035,0.8, 0,dy,0.7, c.BLACK, 8); g.rotation.x=Math.PI/2; } }   // twin MG pods
      for(let r=0;r<2;r++) for(let k=-3;k<=3;k++){ const e=c.mk(c.turretG, c.G.era, E, k*0.34, 0.06+r*0.22, 1.36-r*0.05); e.scale.set(0.95,2.6,0.6); }   // ERA wall on the turret face
      sight(c, 0.62, 0.48, 0.6, 1.2); sight(c, -0.6, 0.5, -0.3, 1.1); slatCage(c, c.turretG, -1.3, 1.3, -2.0, -1.62, -0.2, 0.3); } },
};
export const TANK_ORDER = ['lqt','t90m','ghost','leo2a7','leclerc','abrams','type99','k2','ch3','merkava','t14','colossus'];
// which enemy type wears which hull (the enemy keeps its own paint, stats and hitbox; only the silhouette changes)
export const ENEMY_MODEL = { grunt:'t90m', scout:'recon', gunner:'ifv', mortar:'spg', shield:'merkava', bomber:'ugv', heavy:'t14', chief:'k2', sniper:'td', pyro:'flametank', atgm:'atgmv', engineer:'arv' };   // Z158 each role on the vehicle built for it
export function tankModel(id){ return TANK_MODELS[id] || TANK_MODELS.lqt; }
