// core/config.js — runtime constants derived from config + device: arena size, MOBILE, tank scale, player palette, current BIOME
import { BIOMES, PLAYER, S, gunReach } from '../hub.js';

performance.mark('boot:module');
/* =========================================================================
   THIẾT GIÁP CHIẾN (Steel Siege) — Tank Shooter
   PHASE 1: engine + player tank (move / 360° aim / dash) + twin-stick input.
   Kịch bản: xem GAME_DESIGN.md. Build theo phase, mỗi phase 1 commit.
   ========================================================================= */

// ----------------------------- CONFIG -----------------------------
export const ARENA = 60;                       // half-extent of the square arena (world units)
export const PLAYER_STANDOFF = 0.3;            // enemies keep this much clearance from the player hull (anti-glue → easy to shoot)
export const ARC_G = 110;                      // gravity for ballistic shells — far shots lob in a clear arc, point-blank stays flat (fast guns arc less)
export const MOBILE = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
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
