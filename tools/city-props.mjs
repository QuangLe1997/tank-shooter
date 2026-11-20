// tools/city-props.mjs — Z267 CITY PROPS (maintainer tool): fetches Poly Haven's photoscanned street furniture (CC0, polyhaven.com) and packs each
// piece into a lean game file: the chosen objects of the model (a kit holds many), welded and simplified to a triangle budget (meshoptimizer), the
// 1K photo textures kept. Then shrink the textures with glb-pack (--tex 512 for the small pieces).
//   node tools/city-props.mjs list <polyhaven-id> --deps <dir>     the model's objects (name, triangles, size): what `pick` can choose
//   node tools/city-props.mjs [name …] --deps <dir>                build assets/models/real/city/<name>.glb (all of PROPS when no name is given)
//   node tools/city-props.mjs pack <in.glb> <out.glb> <tris> --deps <dir> [--err 0.02] [--thin 0.25]   Z268 simplify any downloaded model (skinned too) to a triangle budget
//   <dir> holds the packages:  npm i --prefix <dir> @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { createRequire } from 'node:module';

// name → Poly Haven id, the objects kept (a regex on the object names; all when absent), the triangle budget
export const PROPS = {
  prop_lamp:     { id:'street_lamp_01', tris:2600 },                       // a cast-iron lantern post: every street lamp
  prop_gate:     { id:'large_iron_gate', tris:6000 },                      // the villas' wrought-iron gates
  prop_hydrant:  { id:'fire_hydrant', pick:'^fire_hydrant(_cap_0\\d)?_aged$', tris:1400 },   // the weathered one of the pair, without its chain
  prop_bin:      { id:'metal_trash_can', pick:'^metal_trash_can(_handle_(left|right))?$', tris:1400 },   // the pavement bins (the clean one, lid off)
  prop_bench:    { id:'modular_street_seating', pick:'^(crossbar|legs_double|legs_single|suspended_support_01|back_support_[rl]|arm_rest_0[12]|seat|seat_back)$', tris:2400 },   // the kit's assembled bench
  prop_cafe:     { id:'outdoor_table_chair_set_01', tris:3000 },           // a pavement café table with two folding chairs
  prop_chair:    { id:'plastic_monobloc_chair_01', tris:900 },
  prop_barrier:  { id:'concrete_road_barrier_02', tris:900 },             // concrete blocks across the war-torn crossings
  prop_tarpcar:  { id:'covered_car', tris:2400 } };

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const deps = opt('--deps', process.env.GLTF_DEPS); if(!deps){ console.error('needs --deps <dir> (see the header)'); process.exit(1); }
const req = createRequire(path.resolve(deps, 'package.json'));
const { NodeIO } = req('@gltf-transform/core'), F = req('@gltf-transform/functions'), { ALL_EXTENSIONS } = req('@gltf-transform/extensions'), { MeshoptSimplifier } = req('meshoptimizer');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), CACHE = path.join(os.tmpdir(), 'polyhaven-models'), UA = { 'User-Agent':'tank-shooter-assets' }, OUT = 'assets/models/real/city';
const get = async u => { const r = await fetch(u, { headers:UA }); if(!r.ok) throw new Error(r.status + ' ' + u); return Buffer.from(await r.arrayBuffer()); };

async function fetchModel(id){ const dir = path.join(CACHE, id), main = path.join(dir, id + '.gltf'); if(fs.existsSync(main)) return main;
  const g = JSON.parse(await get('https://api.polyhaven.com/files/' + id)).gltf['1k'].gltf;
  for(const [p, f] of Object.entries(g.include)){ const to = path.join(dir, p); fs.mkdirSync(path.dirname(to), { recursive:true }); fs.writeFileSync(to, await get(f.url)); }
  fs.writeFileSync(main, await get(g.url)); return main; }
const tris = doc => { let n = 0; for(const m of doc.getRoot().listMeshes()) for(const p of m.listPrimitives()){ const i = p.getIndices(); n += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; } return n; };

async function list(id){ const doc = await io.read(await fetchModel(id)); await doc.transform(F.flatten());
  for(const n of doc.getRoot().listNodes()){ const m = n.getMesh(); if(!m) continue; const b = F.getBounds(n), s = b.max.map((v, i) => (v - b.min[i]).toFixed(2));
    let t = 0; for(const p of m.listPrimitives()){ const i = p.getIndices(); t += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; }
    console.log(n.getName().padEnd(36), String(t).padStart(7), 'tris  size', s.join(' × '), ' at', b.min.map((v, i) => ((v + b.max[i]) / 2).toFixed(2)).join(',')); } }

async function build(name){ const P = PROPS[name]; if(!P) throw new Error('no prop ' + name); const doc = await io.read(await fetchModel(P.id));
  await doc.transform(F.flatten());
  if(P.pick){ const re = new RegExp(P.pick); for(const n of doc.getRoot().listNodes()) if(n.getMesh() && !re.test(n.getName())) n.dispose(); }
  await doc.transform(F.prune(), F.dedup(), F.weld());
  const t0 = tris(doc), ratio = Math.min(1, P.tris / t0);
  await doc.transform(F.simplify({ simplifier:MeshoptSimplifier, ratio, error:0.02 }), F.prune());
  fs.mkdirSync(OUT, { recursive:true }); const out = path.join(OUT, name + '.glb'); fs.writeFileSync(out, await io.writeBinary(doc));
  console.log(name.padEnd(14), P.id.padEnd(28), t0, '→', tris(doc), 'tris ', (fs.statSync(out).size / 1024).toFixed(0), 'KB'); }

// Z268 any local .glb (a Tripo / Meshy download, skinned or not) welded and simplified to a triangle budget: pack <in> <out> <tris>
async function pack(inp, out, budget){ const doc = await io.read(inp); await doc.transform(F.prune(), F.dedup(), F.weld()); const t0 = tris(doc);
  await doc.transform(F.simplify({ simplifier:MeshoptSimplifier, ratio:Math.min(1, budget / t0), error:+opt('--err', 0.02) }), F.prune());   // Z292 --err: a looser error bound for the phone versions
  const thin = +opt('--thin', 0); if(thin > 0 && thin < 1){ let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);   // Z292 phone foliage: thin the loose leaf cards
    for(const m of doc.getRoot().listMeshes()) for(const p of m.listPrimitives()){ const I = p.getIndices(), P = p.getAttribute('POSITION'); if(!I || !P || P.getComponentType() !== 5126) continue;
      const idx = I.getArray(), pos = P.getArray(), nv = P.getCount(), par = new Int32Array(nv).map((_, i) => i), find = a => { while(par[a] !== a){ par[a] = par[par[a]]; a = par[a]; } return a; };
      for(let t = 0; t < idx.length; t += 3){ const a = find(idx[t]), b = find(idx[t + 1]), c = find(idx[t + 2]); par[b] = a; par[find(c)] = a; }
      const comp = new Map(); for(let t = 0; t < idx.length; t += 3){ const r = find(idx[t]); let c = comp.get(r); if(!c) comp.set(r, c = { tris:[], vs:new Set() }); c.tris.push(t); c.vs.add(idx[t]); c.vs.add(idx[t + 1]); c.vs.add(idx[t + 2]); }
      const keep = [], grow = Math.min(1.8, 1 / Math.sqrt(thin)); for(const c of comp.values()){ if(c.tris.length > 12){ for(const t of c.tris) keep.push(idx[t], idx[t + 1], idx[t + 2]); continue; }   // trunk and boughs stay whole
        if(rnd() > thin) continue; let cx = 0, cy = 0, cz = 0; for(const v of c.vs){ cx += pos[v * 3]; cy += pos[v * 3 + 1]; cz += pos[v * 3 + 2]; } cx /= c.vs.size; cy /= c.vs.size; cz /= c.vs.size;
        for(const v of c.vs){ pos[v * 3] = cx + (pos[v * 3] - cx) * grow; pos[v * 3 + 1] = cy + (pos[v * 3 + 1] - cy) * grow; pos[v * 3 + 2] = cz + (pos[v * 3 + 2] - cz) * grow; }   // a kept card grows to cover for the dropped ones
        for(const t of c.tris) keep.push(idx[t], idx[t + 1], idx[t + 2]); }
      P.setArray(pos); I.setArray(new Uint32Array(keep)); F.compactPrimitive(p); }
    await doc.transform(F.prune()); if(tris(doc) > budget) await doc.transform(F.simplify({ simplifier:MeshoptSimplifier, ratio:Math.min(1, budget / tris(doc)), error:+opt('--err', 0.02) }), F.prune()); }
  fs.writeFileSync(out, await io.writeBinary(doc));
  console.log(path.basename(out).padEnd(20), t0, '→', tris(doc), 'tris'); }

await MeshoptSimplifier.ready;
if(args[0] === 'pack') await pack(args[1], args[2], +args[3]);
else if(args[0] === 'list') await list(args[1]);
else for(const n of args.filter(a => !a.startsWith('--') && a !== deps).length ? args.filter(a => !a.startsWith('--') && a !== deps) : Object.keys(PROPS)) await build(n);
