// MIX 1 the battle mixer from the command line (no browser): node tools/spec.mjs <norm|score> <spec.json | name in tools/specs> [--phone] [--json]
//   norm  → the normalized spec's plan: the world, the sector chain, every config leaf the battle turns (from → to, when), the clamps and the warnings
//   score → the same plus the seven scores with their reasons
//   The arithmetic is src/data/mixer-math.js (pure); the numbers config.js MIXER; the mapping tank-shooter-audit/mixer-mapping.md.
import fs from 'node:fs'; import path from 'node:path';
import { normalizeSpec, scoreBattle } from '../src/data/mixer-math.js';
const [cmd, file] = process.argv.slice(2), flag = f => process.argv.includes(f);
if(!['norm', 'score'].includes(cmd) || !file){ console.log('usage: node tools/spec.mjs <norm|score> <spec.json | name> [--phone] [--json]'); process.exit(2); }
const fp = fs.existsSync(file) ? file : path.join(path.dirname(new URL(import.meta.url).pathname), 'specs', file.replace(/\.json$/, '') + '.json');
let spec; try{ spec = JSON.parse(fs.readFileSync(fp, 'utf8')); }catch(e){ console.log('cannot read ' + fp + ': ' + e.message); process.exit(1); }
const n = normalizeSpec(spec, { device:flag('--phone') ? 'phone' : 'desktop' }), sc = cmd === 'score' ? scoreBattle(n) : null;
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
