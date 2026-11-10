// core/state.js — S — the single runtime game state (mode, stage, wave, score, player, spell, recall …)
import * as THREE from 'three';
import { MOBILE, dprCap, objMod } from '../hub.js';

// ----------------------------- STATE -----------------------------
export const S = {
  mode:'start',                 // start | playing | paused | gameover
  score:0, stage:1, wave:1,
  player:null,
  keys:{}, aimPoint:new THREE.Vector3(), pointerActive:false, firing:false,
  shake:0, dpr:dprCap(),
  weapon:0, spell:0, enemySlowUntil:0, combo:0, comboUntil:0, timeScale:1, awaitingUpgrade:false, timeNow:0,
  zoom: (MOBILE?1.5:1), camYaw:0,   // mobile camera: pull back a bit by default + player-adjustable zoom/rotate
  loop:0,                           // NG+ loop (0 = first playthrough); each loop is harder + pays more
  contract:null,                    // active STAGE CONTRACT (pre-stage modifier choice); null = neutral
};
// ----- STAGE CONTRACT: read its modifiers live at use-sites (coin/hp/dmg/loot/elite) -----
export function cMod(key, dflt){ dflt=(dflt===undefined?1:dflt); const m=S.contract&&S.contract.mods; const v=(m && m[key]!=null) ? m[key] : dflt; return key==='enemyDmgMul' && typeof objMod==='function' ? v*objMod('enemyDmgMul') : v; }
