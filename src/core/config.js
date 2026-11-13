// core/config.js — runtime constants derived from config + device: arena size, MOBILE, tank scale, player palette, current BIOME
import { BIOMES, PLAYER, S, gunReach } from '../hub.js';

performance.mark('boot:module');
/* =========================================================================
   THIẾT GIÁP CHIẾN (Steel Siege) — Tank Shooter
   PHASE 1: engine + player tank (move / 360° aim / dash) + twin-stick input.
   Kịch bản: xem GAME_DESIGN.md. Build theo phase, mỗi phase 1 commit.
   ========================================================================= */

// ----------------------------- CONFIG -----------------------------
const _TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
export const ARENA = _TOUCH ? 130 : 184;      // Z144 desktop: ×2 the ground (184² vs 130²) — roomier battles; phones keep 130 for speed · half-extent of the bounding square (world units) — Z104 60→84, Z106 →130; the playable field is the irregular outline in world/field.js
export const AREA_K = Math.min(4.6, (ARENA/60)**2*0.7);   // Z144 capped: the bigger desktop field gets more open ground, not twice the clutter ·      // Z104 density multiplier (Z106 ×0.7 ≈ the irregular field's share of the bounding square) — scatter scales with real ground
export const PLAYER_STANDOFF = 0.3;            // enemies keep this much clearance from the player hull (anti-glue → easy to shoot)
export const ARC_G = 110;                      // gravity for ballistic shells — far shots lob in a clear arc, point-blank stays flat (fast guns arc less)
export const MOBILE = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
// Z107 NATIVE = running as the installed Mac app (desktop/ Electron shell, Apple Silicon) → it can afford crisper shadows / more detail
export const NATIVE = !!(typeof window!=='undefined' && window.__NATIVE);
// Z109 APPLE = iPhone / iPad / Mac. Apple GPUs render in on-chip tiles, so multisampling and anisotropic filtering cost almost
// nothing there → the sharp path (more pixels, MSAA, crisp ground) is safe; other phones keep the lean defaults.
export const APPLE = typeof navigator!=='undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
export const MSAA = APPLE ? (MOBILE ? 4 : 2) : (MOBILE ? 0 : 2);   // Z150 Mac: 2 samples (4 cost a third of the frame on a big window for an edge you can't tell apart)   // samples on the post-processing buffer (the canvas' own antialias never reaches the screen through it)
export const SHADOW_MAP = 2048;   // Z150 the Mac app too: 4096 cost ~15% of the frame (shadows are snapped + fitted to the view, 2048 stays crisp)
export const TANK_SCALE = 1.2;   // global tank visual+hitbox scale — bigger, more imposing tanks fill the arena better (bosses already huge, excluded)
export const PLAYER_PAL = {hull:0x5e7a2e,turret:0x75933a,barrel:0x9bb04a,tread:0x2a3514,accent:0xe7b54a};   // player's buildTank default palette — used to tint death wreckage
// effective combat range: grows with stage + permanent upgrade + timed buff
export function playerRange(){ const p=S.player; if(!p) return PLAYER.rangeBase;
  const buff = (S.timeNow||0) < p.buffUntil.range ? 1.4 : 1;
  const gid = p.guns && p.guns.length ? p.guns[p.gunIdx].id : 'rifle';
  return (PLAYER.rangeBase + (S.stage-1)*3) * p.rangeMul * buff * gunReach(gid); }
export const CAMPAIGN_BIOMES = 5;   // stages auto-rotate through the first 5; MEADOW is picker-only
export let BIOME = BIOMES[0];
export function __set_BIOME(v){ BIOME=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
