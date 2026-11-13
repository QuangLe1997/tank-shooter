// tools/catalog.mjs — Z162 build functions/catalog.json (every price the server enforces) from the game's own data, so client and server can never disagree.
// run: node tools/catalog.mjs   (npm run catalog; also run by `npm run deploy:functions`)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C=await import(path.join(ROOT,'config.js')), K=await import(path.join(ROOT,'src/data/kit.js')), G=await import(path.join(ROOT,'src/data/guns.js'));
const models=fs.readFileSync(path.join(ROOT,'src/tank/models.js'),'utf8'), tanks={};
for(const m of models.matchAll(/\n  ([a-z0-9]+): \{ name:'[^']*'[\s\S]*?price:(null|\{ ?[cd]:\d+ ?\})/g)) tanks[m[1]] = m[2]==='null' ? null : JSON.parse(m[2].replace(/([cd]):/,'"$1":'));
const kit={}; for(const [id,p] of Object.entries(tanks)) kit[id]=[0,1,2].map(L=>K.kitPrice(p,L));
const cat={ v:Date.now(), guns:C.GUN_PRICE, gunIds:Object.keys(G.GUNS), upgrades:Object.fromEntries(C.SHOP_UP.map(u=>[u.key,u.costs])), tanks, kit, kitTracks:K.KIT_TRACKS.map(t=>t.key), kitMax:K.KIT_MAX,
  kitSigNeed:K.KIT_SIG_NEED, sig:Object.fromEntries(Object.entries(K.KIT_SIG).map(([id,s])=>[id,{ d:s.d }])), crew:Object.fromEntries(K.CREW_RECRUITS.map(r=>[r.id,{ seat:r.seat, lvl:r.lvl, price:r.price }])),
  ammo:Object.fromEntries(C.AMMO_SHOP.map(a=>[a.id,{ box:a.box, price:a.price }])), cap:C.PAYOUT_CAP };
if(Object.keys(tanks).length<10) throw new Error('tank prices not found: '+Object.keys(tanks));
fs.writeFileSync(path.join(ROOT,'functions','catalog.json'), JSON.stringify(cat,null,1)); console.log('catalog: '+Object.keys(cat.guns).length+' guns · '+Object.keys(tanks).length+' tanks · '+Object.keys(cat.upgrades).length+' upgrades · '+Object.keys(cat.ammo).length+' ammo');
