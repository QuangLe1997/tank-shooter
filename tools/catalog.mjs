// tools/catalog.mjs — Z163 build functions/catalog.json (the caps the leaderboard's server enforces) from config.js SCORE_CAP, so client and server can
//   never disagree. run: node tools/catalog.mjs   (firebase.json runs it before every functions deploy)
//   (no-tanks: the gun / tank / upgrade / kit / crew / ammo prices it used to carry are gone with the shop)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C=await import(path.join(ROOT,'config.js'));
const cat={ v:Date.now(), cap:C.SCORE_CAP };
fs.writeFileSync(path.join(ROOT,'functions','catalog.json'), JSON.stringify(cat,null,1)); console.log('catalog: score caps · ' + Object.keys(cat.cap).length + ' keys');
