// campaign/story.js — STORY 1–3 THE CAMPAIGN'S STORY AND THE RADIO THAT FOLLOWS THE FIGHT (config.js STORY: the cast, the five stages' acts, the line pools).
//   ONE ENTRY POINT: storyCue(event, data, must) — the other modules call it where the event already happens (one short call each); it picks a line of that
//     event's pool (a voice that is on the net, never the same variant twice running), fills the names in ({cmd}, {boss}, {name} …: a name is written once,
//     in STORY.cast), and gives it to the radio — or keeps quiet: a flavour line needs STORY.gap s of radio silence (ANY line, whoever said it:
//     campaign/operations.js radio stamps radio.at) and gives way to a queued line that is due; a danger call needs less, and cuts in over a flavour line.
//     It returns false only when the story has no line for the event (the caller's old line is said then); true = the story has dealt with it, said or not.
//   THE PLOT ON THE RADIO: the stage's beats by wave (the leak's sub-plot, the enemy's intercepted traffic) wait in a small queue for their turn — first time
//     through the campaign only. storyTick (game/loop.js, STORY.tick s apart) empties the queue and reads the player's own state: nearly dead, back on his
//     feet, a dry magazine with the enemy near, a squad-mate badly hit.
//   THE TEXT ROUND A STAGE: storyOp — the operation with its names filled in (campaign/operations.js opFor: the briefing, the deployment order, the wave's
//     radio line, the objective's) · storyBrief — the act, the "previously" line (the NG+ framing on a loop), the general's dossier (ui/briefing.js) ·
//     storyEpilogue — the two lines over the rewards of a stage won (loot/upgrades.js) and on the victory screen (campaign/boss.js).
//     The squad's first man of a role carries the cast's name (actors/squad-mates.js: storyMate, storyNamed).
//   Text only: every line goes out with STORY.noVoice, a key audio/voice.js has no file for — the recorded voices stay with the lines they were read from.
import { OPERATIONS, STORY } from '../../config.js';
import { BOSS_DEFS, DIR, FT, S, banterCue, bossForStage, radio, squadList } from '../hub.js';

const C = STORY, NOW = () => performance.now() / 1000, FAR = -1e9;
const words = t => String(t || '').toLocaleLowerCase('vi').replace(/(^|[\s(.-])(\S)/g, (m, a, c) => a + c.toLocaleUpperCase('vi'));   // "BÒ THÉP" → "Bò Thép"
// what the story has said this stage (dev/probes read it): q the lines waiting for their turn · said / lastAt by pool · lastVar the last variant of a pool
export const STY = { q:[], said:{}, lastAt:{}, lastVar:{}, kills:[], first:false, low:false, dry:false, tickAt:0, seen:0, at:FAR, rat:FAR, lastP:0, stats:{ said:0, dropped:0, queued:0, expired:0 } };
const loopNo = () => S.loop || 0;
const stageIx = st => (Math.max(1, st || 1) - 1) % C.stages.length;
// a stage begins (ui/briefing.js goLive): nothing waiting, nothing said yet
export function storyReset(){ const st = STY.stats, L = squadList(); for(const k in st) st[k] = 0; for(let i = 0; i < L.length; i++) L[i].hurtSaid = false;
  STY.q.length = 0; STY.kills.length = 0; STY.said = {}; STY.lastAt = {}; STY.lastVar = {}; STY.first = false; STY.low = false; STY.dry = false; STY.tickAt = 0; STY.seen = 0; STY.at = FAR; STY.rat = FAR; STY.lastP = 0; }

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
// is this voice on the net? (a field mate only while he stands on the field; everybody else always)
function onNet(who){ const c = C.cast[who]; if(!c || !c.field) return true; const L = squadList();
  for(let i = 0; i < L.length; i++){ const r = L[i]; if(r.name === c.name && r.role === c.role && r.a && !r.a.dead && FT.includes(r.a)) return true; } return false; }
const whoOf = line => { const b = line.indexOf('|'); return b > 0 ? line.slice(0, b) : 'cmd'; };
const tagOf = who => who === 'boss' ? general(S.stage).name : (C.cast[who] && C.cast[who].tag) || C.cast.cmd.tag;

// ---- saying a line ----
function speak(line, key, data, now, p){ const b = line.indexOf('|'), who = b > 0 ? line.slice(0, b) : 'cmd';
  radio(tagOf(who) + ': ' + storyText(b > 0 ? line.slice(b + 1) : line, data), C.noVoice);
  STY.said[key] = (STY.said[key] | 0) + 1; STY.lastAt[key] = now; STY.at = now; STY.rat = radio.at ?? now; STY.lastP = p || 3; STY.stats.said++; if(DIR.sayAt < now) DIR.sayAt = now; }   // (the director's own optional lines keep their gap from ours)
// one variant of a pool, among the voices on the net, not the one said last time (a reservoir pick: no list is built); −1: nobody can say it
function pick(key, L){ const t = L.t, last = STY.lastVar[key]; let best = -1, seen = 0;
  for(let i = 0; i < t.length; i++){ if(i === last && t.length > 1 || !onNet(whoOf(t[i]))) continue; if(Math.random() * ++seen < 1) best = i; }
  if(best < 0 && last != null && t[last] && onNet(whoOf(t[last]))) best = last; if(best >= 0) STY.lastVar[key] = best; return best; }
// the pool of an event: its own sub-key's when there is one (a general's id; the role of a mate who carries the cast's name), else the event's
function poolKey(ev, data){ let sub = ''; if(typeof data === 'string') sub = data; else if(data && data.role && storyMate(data.role) === data.name) sub = data.role;
  const L = sub ? C.lines[ev + '_' + sub] : null; return L && !(L.first && loopNo() > 0) ? ev + '_' + sub : C.lines[ev] ? ev : ''; }
function push(it){ const q = STY.q; if(q.length >= C.queueMax){ STY.stats.dropped++; return; } q.push(it); STY.stats.queued++; }
// the queue: the first line whose time has come and whose voice is on the net, once the radio has been quiet long enough for it
function flush(now){ const q = STY.q; if(!q.length || radio.jam) return; if(S.awaitingUpgrade){ q.length = 0; return; } const quiet = now - (radio.at ?? FAR);
  for(let k = 0; k < q.length; k++){ const it = q[k]; if(now > it.until){ q.splice(k--, 1); STY.stats.expired++; continue; }
    if(now < it.from || quiet < it.gap || !onNet(whoOf(it.line))) continue; q.splice(k, 1); speak(it.line, it.key, it, now, 3); return; } }
// is a queued line due? (a flavour line gives way to it)
function due(now){ const q = STY.q; for(let k = 0; k < q.length; k++) if(now >= q[k].from && now <= q[k].until) return true; return false; }
// the stage's plot for this wave (first time through the campaign only): queued, each in its turn
function beats(now){ if(loopNo() > 0) return; const B = C.stages[stageIx(S.stage)].beats[S.wave], T = C.beat; if(!B) return;
  for(let j = 0; j < B.length; j++) push({ line:B[j], key:'beat', name:'', gap:C.gap, from:now + T.first + j * T.next, until:now + T.hold + j * T.next }); }
// an enemy has fallen near the player: the first of the stage, then a run of them
function kill(e, now){ const p = S.player, K = C.streak; if(!p || S.awaitingUpgrade || e && (e.general || e.gaveUp)) return;
  if(e && e.pos){ const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z; if(dx * dx + dz * dz > K.r * K.r) return; }
  if(!STY.first){ STY.first = true; storyCue('first_kill'); return; }
  const a = STY.kills; a.push(now); while(a.length && now - a[0] > K.t) a.shift(); if(a.length >= K.n){ a.length = 0; storyCue('streak'); } }

// THE ENTRY POINT. ev: 'wave' (a wave begins) · 'kill' (data: the enemy) · a pool of STORY.lines ('dir_lull', 'nade', 'mate_down', 'general' …).
//   data: a sub-key (a general's id), or the squad's roster entry the cue is about ({ role, name }). must: say it now, whatever the radio is doing.
export function storyCue(ev, data, must){ banterCue(ev, data); if(!C.on) return false; const now = NOW();   // (VOICE 2 the squad, the enemy and the soldier say their word: audio/banter.js)
  if(ev === 'wave' || ev === 'kill'){ if(S.mode === 'playing'){ if(ev === 'wave') beats(now); else kill(data, now); } return true; }
  const key = poolKey(ev, data); if(!key) return false; if(S.mode !== 'playing') return true;
  const L = C.lines[key], now0 = must || L.p >= 4;
  if(!now0 && (L.max && (STY.said[key] | 0) >= L.max || L.cd && now - (STY.lastAt[key] ?? FAR) < L.cd)) return true;
  const i = pick(key, L); if(i < 0) return false; const name = data && data.name || '';
  if(now0){ speak(L.t[i], key, data, now, 4); return true; }
  if(L.p >= 3 || L.q){ push({ line:L.t[i], key, name, gap:L.p >= 3 ? C.gapMust : C.gap, from:now + (L.q || 0), until:now + C.hold }); flush(now); return true; }
  const over = L.p >= 2 && STY.lastP < 2 && radio.at === STY.rat;                                                  // a danger call cuts in over a flavour line of ours
  if(S.awaitingUpgrade || !over && now - (radio.at ?? FAR) < (L.p >= 2 ? C.gapDanger : C.gap) || L.p < 2 && due(now)){ STY.stats.dropped++; return true; }
  speak(L.t[i], key, data, now, L.p); return true; }
// once a frame in battle (game/loop.js); the work is done STORY.tick s apart: the player's state, the squad's wounded, the queue
export function storyTick(now){ if(now < STY.tickAt) return; STY.tickAt = now + C.tick; const p = S.player; if(!C.on || !p || S.mode !== 'playing') return;
  const lag = STY.seen ? now - STY.seen : 0; STY.seen = now; if(lag > 2) for(let k = 0; k < STY.q.length; k++){ STY.q[k].from += lag; STY.q[k].until += lag; }   // (the game was paused: the waiting lines wait on)
  const hp = p.hp / (p.maxHp || 1), H = C.hp, M = C.mate, g = p.guns && p.guns[p.gunIdx], dry = !!g && !p.infiniteAmmo && g.ammo <= 0, L = squadList();
  if(hp <= 0) STY.low = false; else if(!STY.low && hp < H.low){ STY.low = true; storyCue('hurt'); } else if(STY.low && hp >= H.back){ STY.low = false; storyCue('recovered'); }
  if(dry && !STY.dry && DIR.near > 0) storyCue('dry'); STY.dry = dry;
  for(let i = 0; i < L.length; i++){ const r = L[i], a = r.a; if(!a || a.dead || !a.maxHp) continue; const f = a.hp / a.maxHp;
    if(!r.hurtSaid && f < M.hurt){ r.hurtSaid = true; storyCue('mate_hurt', r); } else if(r.hurtSaid && f >= M.ok) r.hurtSaid = false; }
  flush(now); }

// ---- the text round a stage ----
// operation i with its names filled in (kept, a copy a loop's parity: the generals change on odd loops)
const _ops = {};
export function storyOp(i){ const o = OPERATIONS[i], k = i + ':' + (loopNo() % 2); if(!o) return o; if(_ops[k]) return _ops[k];
  const f = s => storyText(s, null, i + 1), rd = {}; for(const w in o.radio) rd[w] = f(o.radio[w]);
  return (_ops[k] = { ...o, story:f(o.story), brief:f(o.brief), win:f(o.win), radio:rd }); }
// the briefing's story lines for a stage: the act (the loop's number on NG+), the "previously" line (the loop's framing on NG+: it stands for the story
//   paragraph too — loop: true), the general's one-line dossier (a man who carries an original's name on a loop: STORY.heir)
export function storyBrief(stage){ const i = stageIx(stage), st = C.stages[i], lp = loopNo(), b = general(i + 1), heir = lp > 0 && BOSS_DEFS.includes(b);
  return { act:lp > 0 ? 'Vòng ' + (lp + 1) : C.acts[st.act], prev:storyText(lp > 0 ? st.loop : st.prev, null, i + 1), loop:lp > 0, dossier:storyText(heir ? C.heir : C.generals[b.id] || '', null, i + 1) }; }
// the two lines over the rewards of the stage just won
export function storyEpilogue(stage){ const i = stageIx(stage), e = loopNo() > 0 ? C.loopEpi : C.stages[i].epi; return [storyText(e[0], null, i + 1), storyText(e[1], null, i + 1)]; }
