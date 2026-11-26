#!/usr/bin/env node
// tools/skin-poses.mjs — SKIN 2 THE GAME'S POSES FOR tools/skin-repair.mjs (maintainer tool, Node on the CPU). The player's soldier is never posed by his own clips: the hidden operator plays
// his, and src/actors/puppet.js turns the soldier's bones after him. So the repair must be judged in THOSE poses. This script builds the two skeletons as three.js bones straight from the GLBs,
// runs the REAL makePuppet / drivePuppet on a spread of the operator's clip frames and writes every soldier joint's local turn to tools/skin-poses.json, which the repair tool reads.
//   node tools/skin-poses.mjs --three DIR [--src DIR] [--orig DIR]
//   --three  a folder with node_modules/three (r169): the game loads three from a CDN, the repo carries none ( npm i three@0.169.0  in any scratch folder)
//   --src    where src/actors/puppet.js and config.js are read from (default: this repo) — re-run after the puppet changes, then re-run tools/skin-repair.mjs
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
import { readGlb, makeRig, restPose, clipPose, clipLen, PUP_CLIPS, MODELS, DRIVER, ROOT, original } from './skin-repair.mjs';
const av = process.argv.slice(2), val = (k, d) => { const i = av.indexOf(k); return i >= 0 ? av[i + 1] : d; }, three = val('--three'), src = path.resolve(val('--src', ROOT)); if(!three){ console.log('usage: node tools/skin-poses.mjs --three DIR [--src DIR] [--orig DIR]'); process.exit(1); }
const threeUrl = pathToFileURL(path.resolve(three, 'node_modules/three/build/three.module.js')).href, THREE = await import(threeUrl), cfg = await import(pathToFileURL(path.join(src, 'config.js')).href);
// the puppet imports 'three' and '../../config.js': a copy with those two lines pointed at real files runs it unchanged
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skinposes-')), code = fs.readFileSync(path.join(src, 'src/actors/puppet.js'), 'utf8').replace(/from 'three'/, `from '${threeUrl}'`).replace(/from '\.\.\/\.\.\/config\.js'/, `from '${pathToFileURL(path.join(src, 'config.js')).href}'`);
fs.writeFileSync(path.join(tmp, 'puppet.mjs'), code); const { makePuppet, drivePuppet } = await import(pathToFileURL(path.join(tmp, 'puppet.mjs')).href); fs.rmSync(tmp, { recursive: true, force: true });
// one glTF as a tree of bones named the way GLTFLoader names them (':' dropped)
const build = (G, rig) => { const pose = restPose(rig), nodes = G.J.nodes.map((n, i) => { const o = new THREE.Bone(); o.name = (n.name || '').replace(/[:\s]/g, ''); o.position.fromArray(pose[i].t); o.quaternion.fromArray(pose[i].r); o.scale.fromArray(pose[i].s); return o; }), root = new THREE.Group();
  G.J.nodes.forEach((n, i) => (n.children || []).forEach(c => nodes[i].add(nodes[c]))); nodes.forEach((o, i) => { if(rig.parent[i] < 0) root.add(o); }); return { root, nodes }; };
const out = { made: 'src/actors/puppet.js' + (cfg.PUPPET ? ' (PUPPET.full ' + cfg.PUPPET.full + ')' : ' (before POSE 1)'), models: {} }, C = cfg.REALCAV;
for(const [name, drvName] of Object.entries(DRIVER)){ const G = readGlb(original(name, val('--orig'))), rig = makeRig(G), Gd = readGlb(original(drvName, val('--orig'))), rigD = makeRig(Gd), S = build(Gd, rigD), D = build(G, rig), world = new THREE.Group(), sw = new THREE.Group();
  // as actors/real-cav.js sets them up: both in one group, the operator at his scale, the soldier in a wrapper turned by REALCAV.s2.yaw and scaled to the same height
  S.root.scale.setScalar(1 / 1.88); sw.rotation.y = C.s2.yaw; sw.scale.setScalar(C.s2.k || 1); sw.add(D.root); world.add(S.root); world.add(sw); world.updateMatrixWorld(true); const P = makePuppet(S.root, D.root); if(!P) throw new Error('makePuppet failed for ' + name); P.ground = true; const poses = [];
  for(const [clip, at] of PUP_CLIPS){ if(!Gd.J.animations.some(a => a.name === clip)) continue; const ps = clipPose(Gd, rigD, clip, clipLen(Gd, clip) * at); S.nodes.forEach((o, i) => { o.position.fromArray(ps[i].t); o.quaternion.fromArray(ps[i].r); o.scale.fromArray(ps[i].s); }); world.updateMatrixWorld(true); drivePuppet(P); world.updateMatrixWorld(true);
    const r = {}; rig.joints.forEach((nd, k) => { const q = D.nodes[nd].quaternion; if(![q.x, q.y, q.z, q.w].every(Number.isFinite)) throw new Error('bad turn at ' + rig.short[k]); r[rig.short[k]] = [q.x, q.y, q.z, q.w].map(x => +x.toFixed(6)); }); poses.push({ clip, at, r }); }
  out.models[name] = { driver: drvName, poses }; console.log(`${name}: ${poses.length} poses through ${out.made}, driven by ${drvName}`); }
fs.writeFileSync(path.join(ROOT, 'tools/skin-poses.json'), JSON.stringify(out) + '\n'); console.log('wrote tools/skin-poses.json (' + fs.statSync(path.join(ROOT, 'tools/skin-poses.json')).size + ' bytes)');
