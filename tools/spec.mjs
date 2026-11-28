// MIX 1 the battle mixer from the command line (no browser): node tools/spec.mjs <norm|score|check> <spec.json | name in tools/specs> [--phone] [--json] · node tools/spec.mjs schema
//   norm  → the normalized spec's plan: the world, the sector chain, every config leaf the battle turns (from → to, when), the clamps and the warnings
//   score → the same plus the seven scores with their reasons
//   check → MIX 7 THE AGENT'S GATE: exit 1 unless the battle is "good" (config MIXER.score.good: appeal / fairness / joy / variety floors, spec.target's difficulty /
//           intensity / minutes within tolerance, no hard warning) — the fails are printed · schema → writes tools/specs/battle-spec.schema.json (data/mixer-math.js mixSchema)
//   The arithmetic is src/data/mixer-math.js (pure); the numbers config.js MIXER; the mapping tank-shooter-audit/mixer-mapping.md.
import fs from 'node:fs'; import path from 'node:path';
import { normalizeSpec, scoreBattle, mixerCheck, mixSchema } from '../src/data/mixer-math.js';
const [cmd, file] = process.argv.slice(2), flag = f => process.argv.includes(f);
if(cmd === 'schema'){ const out = path.join(path.dirname(new URL(import.meta.url).pathname), 'specs', 'battle-spec.schema.json'); fs.writeFileSync(out, JSON.stringify(mixSchema(), null, 1) + '\n'); console.log('wrote ' + out); process.exit(0); }
if(!['norm', 'score', 'check'].includes(cmd) || !file){ console.log('usage: node tools/spec.mjs <norm|score|check> <spec.json | name> [--phone] [--json] · node tools/spec.mjs schema'); process.exit(2); }
const fp = fs.existsSync(file) ? file : path.join(path.dirname(new URL(import.meta.url).pathname), 'specs', file.replace(/\.json$/, '') + '.json');
let spec; try{ spec = JSON.parse(fs.readFileSync(fp, 'utf8')); }catch(e){ console.log('cannot read ' + fp + ': ' + e.message); process.exit(1); }
const n = normalizeSpec(spec, { device:flag('--phone') ? 'phone' : 'desktop' }), sc = cmd !== 'norm' ? scoreBattle(n) : null;
if(cmd === 'check'){ const r = mixerCheck(n), s2 = r.score; if(flag('--json')){ console.log(JSON.stringify({ ok:r.ok, fails:r.fails, score:{ difficulty:s2.difficulty, intensity:s2.intensity, joy:s2.joy, appeal:s2.appeal, variety:s2.variety, fairness:s2.fairness, minutes:s2.minutes }, target:n.spec.target || null, clamped:n.clamped.length })); process.exit(r.ok ? 0 : 1); }
  console.log((r.ok ? 'PASS ' : 'FAIL ') + (spec.id || path.basename(fp)) + ' · ' + ['difficulty', 'intensity', 'joy', 'appeal', 'variety', 'fairness'].map(k => k + ' ' + s2[k]).join(' · ') + ' · minutes ' + s2.minutes + (n.spec.target ? ' · target ' + JSON.stringify(n.spec.target) : ''));
  for(const x of r.fails) console.log('  ✗ [' + x.id + '] ' + x.vi); if(n.clamped.length) console.log('  (' + n.clamped.length + ' value(s) clamped — run `norm` to see them)'); process.exit(r.ok ? 0 : 1); }
if(flag('--json')){ console.log(JSON.stringify(cmd === 'score' ? { ...n, score:sc } : n, null, 1)); process.exit(0); }
const p = n.plan, w = p.world, f = v => typeof v === 'number' ? +v.toFixed(3) : v;
console.log(`SPEC ${spec.id || path.basename(fp)} · seed ${p.seed} · ${p.device}`);
console.log(`  world: ${w.land} · ${w.tod} · ${w.wx} · ${w.space} · level ${w.level} (stage ${w.stage}, loop ${w.loop}) · diff ${w.diff}`);
console.log(`  macro: ${Object.entries(p.macro).map(([k, v]) => k + ' ' + f(v)).join(' · ')}`);
console.log(`  structure: ${p.structure.sectors ? p.structure.sectors.join(' → ') + (p.structure.auto ? ' (auto from length)' : '') : 'one stage: ' + p.params['enemy.waves'].v + ' waves + the general'} · lives ${p.player.lives}`);
const ch = Object.entries(p.params).filter(([, q]) => q.v !== 50 && !(q.k === 1 && q.src === 'macro')).map(([id, q]) => id + ' ' + f(q.v) + (q.k !== q.v ? ' (×' + f(q.k) + ')' : '') + (q.src === 'spec' ? '*' : ''));
console.log(`  params off neutral (${ch.length}; * = from the spec): ${ch.join(' · ') || 'none'}`);
console.log(`  knobs (${p.knobs.length}):`); for(const q of p.knobs) console.log(`    ${q.read.padEnd(5)} ${q.path} ${f(q.from)} → ${f(q.to)}  [${q.by.join(', ')}]`);
console.log(`  clamped (${n.clamped.length}):`); for(const c of n.clamped) console.log(`    ${c.key}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)} — ${c.why}`);
if(sc){ console.log('  SCORES: ' + ['difficulty', 'intensity', 'joy', 'appeal', 'variety', 'fairness'].map(k => k + ' ' + sc[k]).join(' · ') + ' · minutes ' + sc.minutes);
  for(const k in sc.reasons) console.log(`    ${k}: ${sc.reasons[k].join('; ')}`); console.log('    est: ' + JSON.stringify(sc.est)); }
const ws = sc ? sc.warnings : n.warnings; console.log(`  warnings (${ws.length}):`); for(const x of ws) console.log(`    [${x.id}] ${x.vi}`);
