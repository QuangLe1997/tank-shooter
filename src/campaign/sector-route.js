// campaign/sector-route.js — SECTOR 4 THE ROUTE OF A LONG BATTLE (config.js SECROUTE · the run itself: campaign/sectors.js · the card, the icons, the chip: ui/sector-hud.js).
//   THE DEAL: a run's '*' tokens are free slots filled from the land's deck by a seed fixed for the attempt (sectorDeal — pure: the same tokens, land and seed give the same
//   route; a checkpoint replays it, a new attempt deals again). Some free slots are FORKS: the transit into one stops on a card of two routes (difficulty · reward ·
//   consequence); the pick, or the easier after pickT s, becomes the sector. CONSEQUENCES are carried to the battle's end (SECT.cons): a route's sector won leaves its `win`,
//   the route not taken leaves its `skip`; each sector's start applies them (knobs put back by the run) and the rail shows them as icons. EVENT CARDS: at a sector's start
//   (not the first) a card may be drawn — the same one on a replay — and played for that sector only; a chip by the rail names it.
import { SECROUTE, SECTOR, AWARE, BALANCE, CAV, DIRECTOR, FORTBOSS } from '../../config.js';
import { FT, LOGI, PROFILE, S, SECT, bigEventStart, callFireteam, callStrike, enemies, radio, scene, sectorEventChip, sectorForkCard, sectorKnob, sectorParse, sectorRailCons, spawnAlly } from '../hub.js';

const R = SECROUTE, Y = R.say;
// a small seeded generator (mulberry32): the deal and the cards are a pure function of the attempt's seed
export function seededRng(seed){ let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const draw = (L, rnd) => L.length ? L[(rnd() * L.length) | 0] : null;
export const routeMeta = c => R.meta[c.type + ':' + c.obj] || R.meta[c.place + ':' + c.type] || R.meta[c.type] || { diff:1 };
const entry = tok => { const c = sectorParse(tok); return c ? { ...c, tok, meta:routeMeta(c) } : null; };

// ---- THE DEAL ----
// tokens (strings, '*' = a free slot) of a land → the run's entries; a fork entry carries both routes (fork:[A, B]) and stands as A until one is picked
export function sectorDeal(tokens, land, seed, night){ const rnd = seededRng(seed), out = [], every = R.fork.every, gap = () => every[0] + ((rnd() * (every[1] - every[0] + 1)) | 0);
  const deck = (R.decks[land] || R.decks._).filter(t => { const c = sectorParse(t); return c && (night || c.type !== 'infiltrate'); });
  const frees = tokens.reduce((n, t) => n + (t === '*' ? 1 : 0), 0); let seen = 0, since = 0, want = gap(), forked = false;
  tokens.forEach((t, i) => { if(t !== '*'){ const e = entry(t); if(e){ out.push(e); since++; } return; } seen++;
    const prev = out[out.length - 1], next = tokens[i + 1] && tokens[i + 1] !== '*' ? sectorParse(tokens[i + 1]) : null;
    const fit = deck.filter(x => { const c = sectorParse(x); return (!prev || c.type !== prev.type) && (!next || c.type !== next.type) && !out.some(o => o.tok === x || o.fork && o.fork.some(r => r.tok === x)); });
    const pool = fit.length >= 2 ? fit : deck.filter(x => !out.some(o => o.tok === x)), a = draw(pool.length ? pool : deck, rnd);
    if((since >= want || seen === frees && !forked) && pool.length >= 2){ const others = pool.filter(x => x !== a && sectorParse(x).type !== sectorParse(a).type), b = draw(others.length ? others : pool.filter(x => x !== a), rnd);
      const A = entry(a), B = entry(b); out.push({ ...A, fork:[A, B], pick:-1 }); since = 0; want = gap(); forked = true; }
    else { out.push(entry(a)); since++; } });
  return out.filter(Boolean); }
// the routes' card lines: route k's reward = its own win (else its reward line), its consequence = what the other route's skip leaves
export function forkLines(F){ return F.map((r, k) => { const o = F[1 - k], w = r.meta.win && R.cons[r.meta.win], c = o.meta.skip && R.cons[o.meta.skip];
  return { k, ttl:r.vi + ' · ' + SECTOR.types[r.type].vi, diff:r.meta.diff || 1, reward:w ? w.tx : r.meta.reward || Y.none, cons:c ? c.vi + ': ' + c.tx : Y.none, bad:!!c, icon:w ? w.icon : '' }; }); }
const easier = F => (F[1].meta.diff || 1) < (F[0].meta.diff || 1) ? 1 : 0;

// ---- THE FORK (campaign/sectors.js transit: open → the card; done(k) → the sector) ----
export function forkOpen(c, done){ const F = c.fork, def = easier(F); let left = R.fork.pickT, fin = false;
  const pick = k => { if(fin) return; fin = true; sectorForkCard(null); done(k); };
  sectorForkCard({ kick:Y.fork, ttl:Y.pick, routes:forkLines(F), def, auto:fill(Y.auto, { s:left }), onPick:pick });
  return { tick(dt){ if(fin) return true; left -= dt; sectorForkCard({ auto:fill(Y.auto, { s:Math.max(0, Math.ceil(left)) }) }, true); if(left <= 0) pick(def); return fin; }, pick, def }; }
const fill = (t, o) => String(t ?? '').replace(/\{(\w+)\}/g, (m, k) => o && o[k] != null ? o[k] : '');
// the pick made: the sector becomes that route; the route not taken leaves its skip
export function forkTake(i, k){ const c = SECT.list[i], F = c && c.fork; if(!F) return null; const r = F[k], o = F[1 - k];
  SECT.list[i] = { ...r, fork:null, took:k, alt:o.tok }; SECT.forks.push({ i, took:k, tok:r.tok, alt:o.tok }); if(o.meta.skip) consAdd(o.meta.skip); return SECT.list[i]; }

// ---- THE CONSEQUENCES ----
export function consAdd(id){ const C = R.cons[id]; if(!C || SECT.cons.has(id)) return false; SECT.cons.add(id);
  if(id === 'ammoLess'){ const r = LOGI.res; for(const k in r) r[k] = Math.round(r[k] * C.k); }   // the depot left to the enemy: what he carries now, cut
  sectorRailCons([...SECT.cons].map(x => ({ id:x, ...R.cons[x] }))); return true; }
// a sector won: its route's win
export function consWon(c){ if(c && c.meta && c.meta.win) consAdd(c.meta.win); }
// the refill between sectors: its ammunition share (ammoLess cuts it)
export const consRefillK = () => SECT.cons.has('ammoLess') ? R.cons.ammoLess.refill : 1;
// every sector's start (campaign/sectors.js sectorLive, after its knobs are reset)
function consLive(c, g, now){ const H = SECT.cons, p = S.player;
  if(H.has('noColumn')) sectorKnob(BALANCE.wave, 'base', Math.max(1, BALANCE.wave.base + R.cons.noColumn.wave));
  if(H.has('guards')){ const n = FORTBOSS.guards.n; for(let t = 0; t < n.length; t++) sectorKnob(n, t, n[t] + R.cons.guards.add); }
  if(H.has('mate') && p){ const a = spawnAlly(p.pos.x + 2, p.pos.z + 2, p.facing || 0, 'rifle'); a.name = 'Dân quân'; g.mate = a; }
  if(H.has('strike') && c.type === 'boss') g.strikeAt = R.cons.strike.at;
  sectorRailCons([...H].map(x => ({ id:x, ...R.cons[x] }))); }

// ---- THE EVENT CARDS ----
// the card of sector i (null: none) — a function of the seed and the index only, so a replay draws the same
export function eventFor(seed, i, diff){ const E = R.events; if(i < E.from) return null; const rnd = seededRng((seed ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0);
  if(rnd() >= (E.chance[diff] ?? E.chance.soldier)) return null; let tot = 0; for(const k in E.w) tot += E.w[k]; let x = rnd() * tot; for(const k in E.w){ x -= E.w[k]; if(x <= 0) return k; } return null; }
function playCard(id, g, now){ const E = R.events[id]; g.card = id;
  if(id === 'storm'){ const f = scene.fog; if(f){ if(f.isFogExp2) sectorKnob(f, 'density', f.density / E.fog); else { sectorKnob(f, 'far', f.far * E.fog); sectorKnob(f, 'near', f.near * E.fog); } } sectorKnob(AWARE.see, 'r', AWARE.see.r * E.see); }
  else if(id === 'marksmen'){ const M = DIRECTOR.tactics.marksman; sectorKnob(M, 'chance', Math.max(M.chance, E.chance)); sectorKnob(M, 'max', M.max + E.add); sectorKnob(M, 'dmg', M.dmg * E.dmg); }
  else if(id === 'wounded'){ sectorKnob(CAV.foot, 'run', CAV.foot.run * E.speed); sectorKnob(CAV.foot, 'sprint', CAV.foot.sprint * E.speed); }
  else if(id === 'blackout') sectorKnob(radio, 'jam', true);
  else if(id === 'early'){ const n0 = FT.length, p = S.player; callFireteam(now); if(p) for(let k = 0; k < E.n; k++){ const a = Math.random() * 6.283; spawnAlly(p.pos.x + Math.sin(a) * 4, p.pos.z + Math.cos(a) * 4, p.facing || 0, 'rifle'); } g.early = FT.length - n0; }   // (a full squad still gets the extra men)
  else g.bigAt = E.at;   // a big event, a few seconds in
  sectorEventChip({ vi:E.vi, tx:E.tx, icon:E.icon, good:!!E.good }); SECT.stats.cards = (SECT.stats.cards || 0) + 1; }

// ---- the run's calls (campaign/sectors.js) ----
export function routeLive(c, g, now){ if(!R.on) return; consLive(c, g, now); sectorEventChip(null); const id = eventFor(SECT.seed, SECT.i, PROFILE.difficulty || 'soldier'); if(id) playCard(id, g, now); }
export function routeTick(g, dt, now){ if(!R.on) return; const t = SECT.t;
  if(g.strikeAt && t >= g.strikeAt && enemies.length){ g.strikeAt = 0; callStrike(); SECT.stats.strikes = (SECT.stats.strikes || 0) + 1; }
  if(g.bigAt && t >= g.bigAt){ const k = g.card; g.bigAt = 0; bigEventStart(k, now, true); } }
export function routeEnd(){ sectorEventChip(null); sectorRailCons(null); sectorForkCard(null); }
// dev / probes: play a card on the sector in hand (its knobs go back with the sector's) · what the route holds in a line
export function routeCard(id, now){ const g = SECT.g; if(!g || !R.events[id]) return false; playCard(id, g, now ?? performance.now() / 1000); return true; }
export function routeState(){ return { seed:SECT.seed, cons:[...(SECT.cons || [])], forks:(SECT.forks || []).slice(), card:SECT.g ? SECT.g.card || '' : '', list:SECT.list.map(c => c.fork ? '[' + c.fork.map(r => r.tok).join('|') + ']' : c.tok || c.type) }; }
