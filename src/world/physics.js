// world/physics.js — ORIENTED BOXES (SAT): a hull's footprint (_tb) and the box-vs-box test the walls, the aircraft and the hit tests share
//   (no-tanks: no hull collides any more — the player's tank, the enemy's armour, ramming and the boss's charge are gone)



export const HULL_HW=1.52, HULL_HL=2.05*1.36;   // Z174b the real-length hull                                            // hull half-width / half-length (model units, × tank scale)
export function _tb(t){ const s=t.mesh?t.mesh.scale.x:1; return { x:t.pos.x, z:t.pos.z, f:t.facing||0, hw:HULL_HW*s*0.96, hl:HULL_HL*s*0.95 }; }
export function _ax(f){ const s=Math.sin(f), c=Math.cos(f); return [c,-s, s,c]; }   // right axis (x,z), forward axis (x,z)

