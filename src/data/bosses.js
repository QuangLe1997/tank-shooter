// data/bosses.js — THE GENERALS: the commander who holds each stage's citadel and meets the soldier on foot (campaign/general-duel.js)
//   (no-tanks: their super-heavy machines — armour arcs, breakable parts, phases, shields — are gone; a general is a name and a man)
export const BOSS_DEFS = [
  { id:'bull',     name:'BÒ THÉP' },
  { id:'tempest',  name:'CUỒNG PHONG' },
  { id:'goliath',  name:'KHỔNG LỒ' },
  { id:'reaper',   name:'TỬ THẦN' },
  { id:'overlord', name:'BẠO CHÚA' },
];
// Z161 the new generals: on odd NG+ loops they take the place of the original at that stage
export const BOSS_NEW = [
  { id:'inferno',  name:'HOẢ THẦN' },
  { id:'serpent',  name:'MÃNG XÀ' },
  { id:'thunder',  name:'LÔI THẦN' },
];
export const BOSS_ALT = { 1:'inferno', 3:'serpent', 4:'thunder' };   // stage → the general who replaces the original on odd loops
