// fx/soldier-fx.js — Z306 A MAN IS HIT, NOT A HULL (soldier mode only; the tank keeps fx/cinematic.js playerHitFX): blood off the side the round came from,
//   a flinch of the view and the red marker pointing back at the shooter — no sparks, no armour shards, no plate-sized flash, no hull rocking.
import { gradePass, bloodSpurt, hitMarker } from '../hub.js';

export function soldierHitFX(p, dx, dz, dmg){ const L = Math.hypot(dx || 0, dz || 0);
  bloodSpurt(p.pos.x, p.pos.z, L ? dx : Math.sin(p.facing || 0), L ? dz : Math.cos(p.facing || 0), 0.6 + Math.min(1.2, dmg * 0.025));
  if(L) hitMarker(-dx / L, -dz / L, dmg);
  if(gradePass && gradePass.uniforms.flash) gradePass.uniforms.flash.value = Math.min(0.1, gradePass.uniforms.flash.value + 0.015 + dmg * 0.0015); }
