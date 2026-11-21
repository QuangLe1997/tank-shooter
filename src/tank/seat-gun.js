// tank/seat-gun.js — Z381 THE GUN SEATED IN ITS TURRET. The player's weapons are authored for the procedural turret (their breech at the trunnion,
//   TRUNNION_Z, just behind the procedural mantlet); on a real Meshy turret (tank/real-tanks.js) the tank's own gun — whose sleeve ran into the turret —
//   goes away with the old barrel, and the new one hangs where the procedural turret's face would be: tubes in front of the domed T-90-type turrets'
//   face (0.2–0.3 m of air), launcher pods and twin mounts out in front of the wedge turrets, the rail gun riding over the dome with nothing under it.
//   Once a weapon is on a dressed tank (mountBarrel, a late real turret, a late real gun model) its joint is measured in the turret's own frame and made:
//   · a slim tube (a gun barrel): rays come back along its line on rings round its breech and find the turret's face; it slides back until its breech
//     is `embed` into the face — never so far that its full recoil would push the breech out of the turret's back — and any air still left is closed
//     by a sleeve the girth of the breech;
//   · anything bulkier (a launcher pod, a twin mount, a projector): rays back over a grid on its back find the face; it stays where it is;
//   · then, if its back is still in the open (from the side, at its axis just behind it, no turret), whatever air is left — behind the breech, or
//     under the gun's back where a domed turret falls away beneath a gun laid high — is closed: a
//     tube with only air behind it gets a sleeve the girth of its breech; anything else a mantlet round the gun's back, from the face (or its own
//     back) forward over it, from the turret under it up past its top.
//   The sleeve / mantlet is in the turret's own paint and hangs on the gun's pivot: it lays and lifts with the gun, the gun recoils in it. The
//   muzzle points ride on the gun, so the rounds still leave from its real mouth.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GUNSEAT } from '../../config.js';

const _inv = new THREE.Matrix4(), _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _o = new THREE.Vector3(), _rc = new THREE.Raycaster();
const _fw = new THREE.Vector3(), _bk = new THREE.Vector3(), _dn = new THREE.Vector3(), _lf = new THREE.Vector3(), _rt = new THREE.Vector3();
const under = (o, a) => { for(let q = o; q; q = q.parent) if(q === a) return true; return false; };
const shown = (o, top) => { for(let q = o; q; q = q.parent){ if(!q.visible) return false; if(q === top) return true; } return true; };
// the tank a barrel group hangs on (a real gun model dressed late finds its way back to it)
export function barrelRoot(bg){ for(let q = bg && bg.parent; q; q = q.parent) if(q.userData && q.userData.barrelG === bg && q.userData.turret) return q; return null; }

// seat the mounted gun of a tank (a root built by buildTank); returns { dz, sleeve } (turret-space metres) or null when there is nothing to seat
export function seatBarrel(root){ const u = root && root.userData; if(!u || !u.realDressed || !u.gunId || !u.turret || !u.gunPivot || !u.barrelG) return null;
  const tur = u.turret, gp = u.gunPivot, bg = u.barrelG, G = GUNSEAT, bu = bg.userData;
  if(u.gunSleeve){ if(u.gunSleeve.parent) u.gunSleeve.parent.remove(u.gunSleeve); u.gunSleeve.geometry.dispose(); u.gunSleeve = null; }
  if(bu.elevates === false) return null;   // (the lobbers — mortar, howitzer, rocket rack — stand on their own roof mounts)
  if(bu.z0 == null) bu.z0 = bg.position.z; const kick = bu.z0 - bg.position.z;   // (how far it is recoiled right now)
  if(bu.seatDz){ bu.z0 += bu.seatDz; bu.seatDz = 0; }   // (seated again from where the gun was authored)
  const pose = [tur.rotation.clone(), gp.rotation.clone()]; tur.rotation.set(0, 0, 0); gp.rotation.set(0, 0, 0); bg.position.z = bu.z0; root.updateMatrixWorld(true);
  let res = null;
  try { _inv.copy(tur.matrixWorld).invert();
    // the turret as it is drawn (the real model's: its own gun went with the old barrel) and the gun as it is drawn
    const turM = [], gunM = []; tur.traverse(o => { if(!o.isMesh || !shown(o, root)) return; if(under(o, bg)) gunM.push(o); else if(o.userData.real && !(u.gunMount && under(o, u.gunMount))) turM.push(o); });
    if(!turM.length || !gunM.length) return null;
    // the gun's breech: its rear end (turret space) and the box of its back section (its axis and girth there)
    let zMin = Infinity, zMax = -Infinity, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const each = f => { for(const o of gunM){ const P = o.geometry.attributes.position; if(!P) continue; _m.multiplyMatrices(_inv, o.matrixWorld); for(let i = 0; i < P.count; i++){ _v.fromBufferAttribute(P, i).applyMatrix4(_m); f(_v); } } };
    each(v => { if(v.z < zMin) zMin = v.z; if(v.z > zMax) zMax = v.z; });
    const sect = Math.max(G.rear, (zMax - zMin) * G.rearK);
    each(v => { if(v.z > zMin + sect) return; if(v.x < x0) x0 = v.x; if(v.x > x1) x1 = v.x; if(v.y < y0) y0 = v.y; if(v.y > y1) y1 = v.y; });
    if(!isFinite(zMin) || !isFinite(x0)) return null;
    const ax = (x0 + x1) / 2, ay = (y0 + y1) / 2, rw = Math.max(0.04, (x1 - x0) / 2), rh = Math.max(0.04, (y1 - y0) / 2), slim = Math.max(rw, rh) <= G.slim;
    _fw.set(0, 0, 1).transformDirection(tur.matrixWorld); _bk.copy(_fw).negate(); _dn.set(0, -1, 0).transformDirection(tur.matrixWorld); _lf.set(-1, 0, 0).transformDirection(tur.matrixWorld); _rt.set(1, 0, 0).transformDirection(tur.matrixWorld); const sc = tur.matrixWorld.getMaxScaleOnAxis();
    const cast = (x, y, z, dir, far) => { _o.set(x, y, z).applyMatrix4(tur.matrixWorld); _rc.set(_o, dir); _rc.far = far * sc; const h = _rc.intersectObjects(turM, false)[0]; return h ? h.point.applyMatrix4(_inv) : null; };
    const pick = L => { L.sort((a, b) => a - b); return L[Math.floor((L.length - 1) * G.pick)]; };
    // the turret's face behind the breech: rays back along the gun's line — round a slim tube on rings, over a bulky gun's back on a grid
    const back = [], pts = [];
    if(slim){ for(const k of G.ring) for(let i = 0; i < G.rays; i++){ const a = i / G.rays * Math.PI * 2; pts.push([ax + Math.cos(a) * rw * k, ay + Math.sin(a) * rh * k]); } }
    else for(const fx of G.grid) for(const fy of G.grid) pts.push([ax + fx * rw, ay + fy * rh]);
    for(const [x, y] of pts){ const h = cast(x, y, zMin + G.look, _bk, G.look + G.reach); if(h) back.push(h.z); }
    const face = back.length >= pts.length * G.hitK ? pick(back) : null, near = face != null ? back[Math.floor((back.length - 1) * G.slidePick)] : null;   // (pick sorts: the slide goes to a nearer hit — no further in than the face needs)
    const tb = cast(ax, ay, zMin - G.deep, _fw, G.deep + G.look), tail = tb ? tb.z : zMin - G.deep;   // (the turret's back, on the same line)
    let dz = 0, sleeve = 0, block = null;
    const mat = turM[0].material, put = (geo, name) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; m.name = name; m.userData.real = true; m.userData.keep = true;
      _m.copy(gp.matrixWorld).invert().multiply(tur.matrixWorld); m.applyMatrix4(_m); gp.add(m); u.gunSleeve = m; return m; };   // (on the gun's pivot: it lays with the gun, the gun recoils in it)
    // a slim tube slides back into the face — not so far that its full recoil would push the breech out of the turret's back
    if(face != null && slim){ const travel = (u.rig ? u.rig.recoilLen : 0.42) * G.recoil, want = zMin - (near - G.embed), room = zMin - (tail + G.back + travel);
      dz = Math.max(0, Math.min(want, room, G.maxShift)); if(dz > 0.004){ bu.z0 -= dz; bu.seatDz = dz; } else dz = 0; }
    const rear = zMin - dz, d = Math.min(sect, G.block.d);
    // what is left: air behind the breech (to the face), air under the back section (down to the turret: a domed turret falls away under a gun laid high)
    const backGap = face != null ? rear - face : null, below = [];
    for(const fx of G.grid) for(const fz of [0.1, 0.5, 0.9]){ const h = cast(ax + fx * rw, y0 + 0.02, rear + fz * d, _dn, G.drop + 0.02); if(h) below.push(h.y); }
    const floor = below.length >= G.grid.length * 3 * G.floorK ? pick(below) : null, underGap = floor != null ? y0 - floor : null;   // (pick: one of the lower hits — the turret falling away)
    // is its back exposed? just behind its back, seen from either side (at its underside, middle and top) and from above (the turret up to its top,
    //   across its width): the turret there, or air (a gun already in the turret is left be)
    const behind = (y) => [1, -1].some(sx => !!cast(ax + sx * G.side, y, rear - G.peek, sx > 0 ? _lf : _rt, G.side * 2)), over = (x) => { const h = cast(x, y1 + G.side, rear - G.peek, _dn, G.side + (y1 - y0) + G.drop); return !!h && h.y >= y1 - G.peek; },
      backed = [-G.band, 0, G.band].every(k => behind(ay + k * rh)) && [-G.band, 0, G.band].every(k => over(ax + k * rw));   // (its whole height from the side, its whole width from above)
    if(backed || (face == null && floor == null)){ /* backed by the turret, or clear of it altogether (a roof mount): nothing to add */ }
    else if(slim && (underGap == null || underGap <= G.sleeve.min) && backGap != null && backGap > G.sleeve.min){
      // a tube with only air behind it: a sleeve the girth of its breech
      const r = Math.min(G.sleeve.r[1], Math.max(G.sleeve.r[0], Math.max(rw, rh) * G.sleeve.k)), z0 = face - G.embed, z1 = rear + G.sleeve.over, len = z1 - z0;
      const geo = new THREE.CylinderGeometry(r, r * G.sleeve.flare, len, 24); geo.rotateX(Math.PI / 2); geo.translate(ax, ay, (z0 + z1) / 2); put(geo, 'gun_sleeve'); sleeve = len; }
    else if((backGap != null && backGap > G.sleeve.min) || (underGap != null && underGap > G.sleeve.min)){
      // a mantlet round the gun's back: from the face (or its own back) forward over it, from the turret under it up past its top
      const hw = Math.min(G.block.w / 2, Math.max(rw, rh * 0.8) * (slim ? G.block.tube : G.block.k)), top = slim ? ay + Math.max(rh * 1.5, G.block.lip) : y0 + (y1 - y0) * G.block.up;
      const bot = floor != null ? floor - G.embed : (slim ? ay - Math.max(rh * 1.5, G.block.lip) : y0 - G.block.lip * 0.3);
      const z0 = backGap != null && backGap > 0 ? face - G.embed : rear - G.embed, z1 = rear + Math.max(G.block.over, d * (slim ? 0.25 : 0.6)), w = hw * 2, h = top - bot, len = z1 - z0;
      if(h > 0.05 && len > 0.05){ const geo = new RoundedBoxGeometry(w, h, len, 2, Math.min(w, h, len) * 0.14); geo.translate(ax, (top + bot) / 2, (z0 + z1) / 2); put(geo, 'gun_mantlet'); block = [w, h, len]; } }
    res = { dz:+dz.toFixed(3), sleeve:+sleeve.toFixed(3), block:block && block.map(v => +v.toFixed(2)), face:face == null ? null : +face.toFixed(3), floor:floor == null ? null : +floor.toFixed(3), hits:[back.length, pts.length, below.length], backed, slim, rear:+zMin.toFixed(3) }; u.gunSeat = res; }
  finally { tur.rotation.copy(pose[0]); gp.rotation.copy(pose[1]); bg.position.z = bu.z0 - kick; root.updateMatrixWorld(true); }
  return res; }
