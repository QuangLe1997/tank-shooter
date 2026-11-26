// campaign/story.js — STORY 1 THE CAMPAIGN'S STORY: one story across the five operations and a named cast (config.js STORY: the cast, the stages' acts, the lines).
//   A NAME IS WRITTEN ONCE: every text names people by key ({cmd}, {mg}, {scout}, {boss} …) and storyText fills them in from STORY.cast and the generals'
//   own table (data/bosses.js). storyOp is the operation of a stage with its names filled in (campaign/operations.js opFor: the briefing, the deployment
//   order, the wave's radio line, the objective's). The squad's first man of a role carries the cast's name (actors/squad-mates.js: storyMate, storyNamed).
import { OPERATIONS, STORY } from '../../config.js';
import { BOSS_DEFS, S, bossForStage } from '../hub.js';

const C = STORY;
const words = t => String(t || '').toLocaleLowerCase('vi').replace(/(^|[\s(.-])(\S)/g, (m, a, c) => a + c.toLocaleUpperCase('vi'));   // "BÒ THÉP" → "Bò Thép"
const loopNo = () => S.loop || 0;

// ---- the names ----
function general(st){ return bossForStage(Math.max(1, Math.min(BOSS_DEFS.length, st || 1))) || BOSS_DEFS[0]; }
// {key} → the cast's name · {boss} the general of `stage` (this one when not given) · {g1}…{g5} the original generals · {name} the mate the cue is about
export function storyText(s, data, stage){ return String(s || '').replace(/\{(\w+)\}/g, (m, k) => {
  if(k === 'name') return data && data.name || 'đồng đội';
  if(k === 'boss') return words(general(stage || S.stage).name);
  if(k.length === 2 && k[0] === 'g' && BOSS_DEFS[k[1] - 1]) return words(BOSS_DEFS[k[1] - 1].name);
  const c = C.cast[k]; return c ? c.name : m; }); }
// the squad's first man of a role carries the cast's name (actors/squad-mates.js); nobody else is given a name the story uses
export function storyMate(role){ const c = C.cast[role]; return c && c.field ? c.name : ''; }
export function storyNamed(name){ for(const k in C.cast) if(C.cast[k].name === name) return true; return false; }

// ---- the text round a stage ----
// operation i with its names filled in (kept, a copy a loop's parity: the generals change on odd loops)
const _ops = {};
export function storyOp(i){ const o = OPERATIONS[i], k = i + ':' + (loopNo() % 2); if(!o) return o; if(_ops[k]) return _ops[k];
  const f = s => storyText(s, null, i + 1), rd = {}; for(const w in o.radio) rd[w] = f(o.radio[w]);
  return (_ops[k] = { ...o, story:f(o.story), brief:f(o.brief), win:f(o.win), radio:rd }); }
