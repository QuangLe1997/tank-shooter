// world/physics.js — ORIENTED BOXES (SAT): a hull's footprint (_tb) and the box-vs-box test the walls, the aircraft and the hit tests share
//   (no-tanks: no hull collides any more — the player's tank, the enemy's armour, ramming and the boss's charge are gone)



export const HULL_HW=1.52, HULL_HL=2.05*1.36;   // Z174b the real-length hull                                            // hull half-width / half-length (model units, × tank scale)
export function _tb(t){ const s=t.mesh?t.mesh.scale.x:1; return { x:t.pos.x, z:t.pos.z, f:t.facing||0, hw:HULL_HW*s*0.96, hl:HULL_HL*s*0.95 }; }
export function _ax(f){ const s=Math.sin(f), c=Math.cos(f); return [c,-s, s,c]; }   // right axis (x,z), forward axis (x,z)
export function satOBB(A,B){
  const a=_ax(A.f), b=_ax(B.f), dx=B.x-A.x, dz=B.z-A.z; let best=1e9, nx=0, nz=0;
  for(let k=0;k<4;k++){ const ux = k<2 ? a[k*2] : b[(k-2)*2], uz = k<2 ? a[k*2+1] : b[(k-2)*2+1];
    const pa=A.hw*Math.abs(ux*a[0]+uz*a[1]) + A.hl*Math.abs(ux*a[2]+uz*a[3]);
    const pb=B.hw*Math.abs(ux*b[0]+uz*b[1]) + B.hl*Math.abs(ux*b[2]+uz*b[3]);
    const dist=dx*ux+dz*uz, ov=pa+pb-Math.abs(dist); if(ov<=0) return null;
    if(ov<best){ best=ov; const sg=dist<0?-1:1; nx=ux*sg; nz=uz*sg; } }
  return { nx, nz, d:best };
}

