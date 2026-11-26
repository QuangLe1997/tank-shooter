// actors/crew.js — Z245 the G key and the crew button: get on / off the ride (no-tanks: there is no tank crew to seat on the hull or call back)
import { S, cavToggleMount, knifeContext } from '../hub.js';

export function crewPress(){ if(S.player && S.mode === 'playing' && !knifeContext()) cavToggleMount(); }   // SUPPLY 3 while a silent takedown is on offer the key is the knife (game/quiet.js)
export function crewRelease(){}
// the crew button (phones): a tap gets on / off the ride
{ const b = typeof document !== 'undefined' && document.getElementById('mCrew'); if(b){ const dn = ev => { ev.stopPropagation(); ev.preventDefault(); crewPress(); };
  b.addEventListener('touchstart', dn, { passive:false }); b.addEventListener('mousedown', dn); } }
