// net/rules.js — COOP 4 THE RULES BOTH PAGES MUST AGREE ON, AS PLAIN FUNCTIONS (they run in Node: tools/coop-test.mjs): the cue codes, whether two machines can
// build the same battlefield, the seed in the address, a hit report's parameter, which of the two players an enemy regards, and going down / being stood up again
import { COOP } from '../../config.js';

export const NET_CUE = COOP.cue;
// ---- the lobby: can these two pages build the same land? mine / theirs = { mobile, arena, quality }. '' = yes · 'mobile' (a phone with a desktop: the field's size
//   and half the world's builders branch on it) · 'arena' (another field size) — both refuse the battle; 'quality' only warns (it changes what is drawn)
export function coopLobbyClash(mine, theirs){ if(!mine || !theirs) return ''; if(theirs.mobile != null && !!mine.mobile !== !!theirs.mobile) return 'mobile';
  if(theirs.arena != null && (mine.arena | 0) !== (theirs.arena | 0)) return 'arena'; if(theirs.quality != null && String(mine.quality) !== String(theirs.quality)) return 'quality'; return ''; }
export function coopClashFatal(code){ return code === 'mobile' || code === 'arena'; }
// the page's address with seed=N set (the seed is read before any module runs — boot/safety.js — so a page that must change it reloads at this address)
export function coopSeedUrl(href, seed){ const s = String(href || ''), h = s.indexOf('#'), hash = h >= 0 ? s.slice(h) : '', base = h >= 0 ? s.slice(0, h) : s, q = base.indexOf('?'), path = q >= 0 ? base.slice(0, q) : base;
  const parts = (q >= 0 ? base.slice(q + 1) : '').split('&').filter(p => p && !/^seed=/.test(p)); parts.push('seed=' + ((+seed >>> 0) || 1)); return path + '?' + parts.join('&') + hash; }
// a 32-bit score in a CUE's two 16-bit fields
export function coopScoreAB(score){ const v = Math.max(0, Math.min(0xffffffff, Math.round(+score || 0))); return [v & 0xffff, (v >>> 16) & 0xffff]; }
export function coopScoreOf(a, b){ return ((b & 0xffff) * 65536) + (a & 0xffff); }
// ---- a hit the guest reports: HIT a = who fired (COOP.ids.guest), b = the enemy's id, x / z = the way the round flew (a unit vector), y = the weapon's index / 100,
//   p = damage × 10 in 15 bits (≤ 3276.7) + bit 15 = a heavy round (it throws the man). The host caps what one report may take (COOP.puppet.hitMax).
export function coopHitP(dmg, heavy){ const v = Math.round((+dmg || 0) * 10); return (v > 32767 ? 32767 : v > 0 ? v : 0) | (heavy ? 0x8000 : 0); }
export function coopHitOf(p, out){ out = out || {}; out.dmg = Math.min(COOP.puppet.hitMax, (p & 0x7fff) / 10); out.heavy = !!(p & 0x8000); return out; }
// ---- which of the two players an enemy soldier regards on the host: 0 = the host's soldier, 1 = the guest's. A man who is down is nobody's target while the other
//   stands; the one regarded is kept until the other is `stick` × nearer (so a man does not flick between two players the same distance off)
export function coopFocusPick(cur, dHost, dGuest, hostDown, guestDown, stick){ if(guestDown && !hostDown) return 0; if(hostDown && !guestDown) return 1;
  const k = stick == null ? COOP.focus.stick : stick; if(cur === 1) return dHost < dGuest * k ? 0 : 1; return dGuest < dHost * k ? 1 : 0; }
// ---- down and up again. D = { on, k, lost } (makeCoopDown()). A player at no health: coopDownEnter(D, mate) → 'down' (the other stands: he crawls and waits),
//   'lost' (the other is down too, or nobody is there to stand him up: mate.present false → 'alone', the single-player death takes over).
//   Every frame while down: coopDownStep(D, dt, mate) with mate = { present, down, dist (m) } → '' | 'up' (stood up: the caller gives him hpK of his health) |
//   'lost' (the other went down too) | 'alone' (the other left). D.k = 0–1 how far the other has got with it (both pages show it).
export function makeCoopDown(){ return { on:false, k:0, lost:false }; }
export function coopDownEnter(D, mate){ D.k = 0; if(!mate || !mate.present){ D.on = false; return 'alone'; } if(mate.down){ D.on = true; D.lost = true; return 'lost'; } D.on = true; D.lost = false; return 'down'; }
export function coopDownStep(D, dt, mate){ if(!D.on) return ''; const C = COOP.down;
  if(!mate || !mate.present){ D.on = false; D.k = 0; return 'alone'; } if(mate.down){ D.lost = true; return 'lost'; }
  if(mate.dist <= C.r) D.k = Math.min(1, D.k + dt / C.reviveS); else D.k = Math.max(0, D.k - dt / C.reviveS * C.decay);
  if(D.k >= 1){ D.on = false; D.k = 0; return 'up'; } return ''; }
// what the OTHER page shows meanwhile (it sees only his DOWNED flag and where he lies): the same count, kept by the same rule
export function coopReviveShow(k, dt, dist, mateDown){ const C = COOP.down; if(!mateDown) return 0; return dist <= C.r ? Math.min(1, k + dt / C.reviveS) : Math.max(0, k - dt / C.reviveS * C.decay); }
// ---- a grenade in the air (GRENADE): a / b = where it left the hand (x, z as centimetres + 32768 in the event's two 16-bit fields), x / z = where it comes down,
//   y = how high its arc goes (m), p = its flight time in ms
export function coopU16M(m){ const v = Math.round((+m || 0) * 100) + 32768; return v > 65535 ? 65535 : v > 0 ? v : 0; }
export function coopMU16(a){ return ((a & 0xffff) - 32768) / 100; }
// ---- an explosion (EXPLOSION): x, y, z = where, a = its colour's upper 16 bits, b = the lower 8, p = its size × 100
export function coopBlastAB(color){ const c = (color >>> 0) & 0xffffff; return [c >>> 8, c & 0xff]; }
export function coopBlastColor(a, b){ return ((a & 0xffff) << 8) | (b & 0xff); }
