// tools/meshy.mjs — Z248 Meshy generation runner (maintainer tool; the game never loads it). Reads the spec in tools/meshy-assets.json,
// keeps a ledger per asset so a step is NEVER created twice (Meshy charges on create, has no idempotency key,
// and a timed-out create may still have run; one ledger per asset, assets/models/meshy/<asset>/ledger.json), polls politely (Retry-After), downloads every GLB / thumbnail into assets/models/meshy/<asset>/.
//   node tools/meshy.mjs balance
//   node tools/meshy.mjs run <asset> <step>      step: preview | refine | retex | rig | anim | motion:<name> | motionanim:<name>
//   node tools/meshy.mjs wait <asset> <step>     resume waiting on a step already created (never creates)
//   node tools/meshy.mjs status
// Key: $MESHY_API_KEY or ~/.config/tank-shooter/meshy.key (never printed).
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'meshy-assets.json'), 'utf8'));
const OUT = path.join(ROOT, 'assets', 'models', 'meshy');
const API = 'https://api.meshy.ai/openapi';
const KEY = (process.env.MESHY_API_KEY || (() => { try { return fs.readFileSync(path.join(os.homedir(), '.config', 'tank-shooter', 'meshy.key'), 'utf8'); } catch { return ''; } })()).trim();
if(!KEY) { console.error('no Meshy key ($MESHY_API_KEY or ~/.config/tank-shooter/meshy.key)'); process.exit(2); }
const H = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// one ledger file per asset: parallel runs on different assets never overwrite each other's task ids
const LF = a => path.join(OUT, a, 'ledger.json');
const assets = () => Object.keys(SPEC).filter(k => !k.startsWith('_'));
const load = () => { const L = {}; for(const a of assets()) { try { L[a] = JSON.parse(fs.readFileSync(LF(a), 'utf8')); } catch {} } return L; };
const save = (L, a) => { fs.mkdirSync(path.join(OUT, a), { recursive: true }); fs.writeFileSync(LF(a), JSON.stringify(L[a] || {}, null, 2) + '\n'); };

const strip = o => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));
// which endpoint a step lives on, and the request body (built from the spec + earlier steps' task ids)
function plan(asset, step, L){
  const A = SPEC[asset]; if(!A) throw new Error('unknown asset ' + asset);
  const done = s => { const e = L[asset] && L[asset][s]; if(!e || e.status !== 'SUCCEEDED') throw new Error(`${asset}/${s} has not succeeded yet`); return e.id; };
  const [kind, name] = step.split(':');
  if(kind === 'preview') return { ep: 'v2/text-to-3d', body: A.preview };
  if(kind === 'refine') return { ep: 'v2/text-to-3d', body: { ...A.refine, preview_task_id: done('preview') } };
  if(kind === 'retex') return { ep: 'v1/retexture', body: { ...strip(A.retex), input_task_id: done('refine') } };
  if(kind === 'rig'){ const R = strip(A.rig);
    if(R.model_file){ const f = R.model_file; delete R.model_file; return { ep: 'v1/rigging', body: { ...R, model_url: 'data:model/gltf-binary;base64,' + fs.readFileSync(path.join(ROOT, f)).toString('base64') } }; }
    const src = R.input || (A.retex ? 'retex' : 'refine'); delete R.input; return { ep: 'v1/rigging', body: { ...R, input_task_id: done(src) } }; }
  if(kind === 'anim') return { ep: 'v1/animations', body: { rig_task_id: done('rig'), action_ids: A.anim.action_ids } };
  const M = (A.motion || []).find(m => m.name === name);
  if(kind === 'motion' && M) return { ep: 'v1/text-to-motion', body: { prompt: M.prompt, mode: M.mode, duration: M.duration } };
  if(kind === 'motionanim' && M) return { ep: 'v1/animations', body: { rig_task_id: done('rig'), motion_task_id: done('motion:' + name) } };
  throw new Error('unknown step ' + step); }

async function create(asset, step){
  const L = load(), e = L[asset] && L[asset][step];
  if(e && e.status !== 'FAILED') { console.log(`${asset}/${step}: already created (${e.id}, ${e.status}) — not creating again`); return e; }
  const { ep, body } = plan(asset, step, L);
  let res;
  try { res = await fetch(`${API}/${ep}`, { method: 'POST', headers: H, body: JSON.stringify(body) }); }
  catch(err) { console.error(`${asset}/${step}: network error on create — it MAY have been created and charged. Do not re-run; list the newest tasks first.`, err.message); process.exit(3); }
  const txt = await res.text();
  if(res.status >= 500) { console.error(`${asset}/${step}: HTTP ${res.status} on create — may have been created. Check the task list before retrying.`, txt.slice(0, 300)); process.exit(3); }
  if(!res.ok) { console.error(`${asset}/${step}: HTTP ${res.status} (nothing created, nothing charged):`, txt.slice(0, 400)); process.exit(4); }
  const id = JSON.parse(txt).result;
  L[asset] = L[asset] || {}; L[asset][step] = { id, ep, status: 'PENDING', created: new Date().toISOString() }; save(L, asset);
  console.log(`${asset}/${step}: created ${id}`); return L[asset][step]; }

function urls(o, acc = [], key = ''){
  if(typeof o === 'string'){ if(/^https?:\/\//.test(o) && /(\.glb|\.png|\.jpe?g)(\?|$)/i.test(o)) acc.push([key, o]); }
  else if(o && typeof o === 'object') for(const [k, v] of Object.entries(o)) urls(v, acc, key ? key + '.' + k : k);
  return acc; }

async function wait(asset, step){
  const L = load(), e = L[asset] && L[asset][step]; if(!e) throw new Error(`${asset}/${step} was never created`);
  const t0 = Date.now(); let last = -1, task;
  while(true){
    let r; try { r = await fetch(`${API}/${e.ep}/${e.id}`, { headers: H }); } catch { await sleep(10000); continue; }
    if(r.status === 429 || r.status >= 500){ await sleep(10000); continue; }
    task = await r.json();
    if(task.progress !== last && (task.progress % 25 === 0 || ['SUCCEEDED', 'FAILED', 'CANCELED'].includes(task.status))) { last = task.progress; console.log(`${asset}/${step}: ${task.status} ${task.progress}%`); }
    if(['SUCCEEDED', 'FAILED', 'CANCELED'].includes(task.status)) break;
    if(Date.now() - t0 > 75 * 60e3) { console.log(`${asset}/${step}: still ${task.status} after 75 min — run "wait" later`); return; }
    await sleep(Math.max(5, +(r.headers.get('retry-after') || 5)) * 1000); }
  const L2 = load(); Object.assign(L2[asset][step], { status: task.status, credits: task.consumed_credits, error: task.task_error && task.task_error.message || undefined, finished: new Date().toISOString() }); save(L2, asset);
  if(task.status !== 'SUCCEEDED') { console.log(`${asset}/${step}: ${task.status}`, task.task_error || ''); return; }
  const dir = path.join(OUT, asset); fs.mkdirSync(dir, { recursive: true }); const got = [];
  for(const [k, u] of urls({ model_urls: task.model_urls, thumbnail_url: task.thumbnail_url, result: task.result })){
    const ext = (u.match(/\.(glb|png|jpe?g)(\?|$)/i) || [])[1].toLowerCase(), file = `${step.replace(':', '-')}.${k.replace(/[^\w.]+/g, '_')}.${ext}`;
    const b = Buffer.from(await (await fetch(u)).arrayBuffer()); fs.writeFileSync(path.join(dir, file), b); got.push(`${file} (${(b.length / 1048576).toFixed(1)} MB)`); }
  fs.writeFileSync(path.join(dir, step.replace(':', '-') + '.task.json'), JSON.stringify(task, null, 2));
  console.log(`${asset}/${step}: SUCCEEDED, ${task.consumed_credits} credits →`, got.join(', ')); }

const [cmd, asset, step] = process.argv.slice(2);
if(cmd === 'balance'){ const r = await fetch(`${API}/v1/balance`, { headers: H }); console.log(r.status, await r.text()); }
else if(cmd === 'status'){ const L = load(); for(const [a, S] of Object.entries(L)) for(const [s, e] of Object.entries(S)) console.log(`${a}/${s}`.padEnd(28), e.status.padEnd(10), String(e.credits ?? '').padStart(3), e.id); }
else if(cmd === 'run'){ await create(asset, step); await wait(asset, step); }
else if(cmd === 'wait'){ await wait(asset, step); }
else { console.log('usage: node tools/meshy.mjs balance | status | run <asset> <step> | wait <asset> <step>'); }
