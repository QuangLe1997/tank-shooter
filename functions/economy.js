// functions/economy.js — Z162 the server's economy rules, pure (no Firebase): migrate a local save, validate a purchase, clamp a run's payout.
// Shared by index.js (Cloud Functions) and test.js. Prices come from catalog.json (built from the game's own data by tools/catalog.mjs).
const int=(v,lo,hi)=>Math.max(lo, Math.min(hi, Math.floor(Number(v)||0)));
const uniq=a=>[...new Set(a)];
export function freshState(){ return { coins:0, diamonds:0, guns:['rifle'], tanks:['lqt'], upgrades:{}, kit:{}, crew:['d_cmd','d_gun','d_drv','d_ldr'], ammo:{}, meta:{} }; }
// first contact: what the device already had comes across, within limits (unknown items dropped, levels clamped, wallet capped)
export function migrate(p, cat){ p=p&&typeof p==='object'?p:{}; const s=freshState();
  s.coins=int(p.coins,0,cat.cap.migrateCoins); s.diamonds=int(p.diamonds,0,cat.cap.migrateDia);
  s.guns=uniq(['rifle', ...(Array.isArray(p.ownedGuns)?p.ownedGuns:[]).filter(g=>cat.gunIds.includes(g))]);
  s.tanks=uniq(['lqt', ...(Array.isArray(p.ownedTanks)?p.ownedTanks:[]).filter(t=>Object.prototype.hasOwnProperty.call(cat.tanks,t))]);
  for(const [k,L] of Object.entries(p.upgrades||{})) if(cat.upgrades[k]) s.upgrades[k]=int(L,0,cat.upgrades[k].length);
  for(const [id,k] of Object.entries(p.kit||{})) if(cat.kit[id] && s.tanks.includes(id) && k && typeof k==='object'){ const o={}; for(const t of cat.kitTracks) o[t]=int(k[t],0,cat.kitMax); o.sig=!!k.sig && !!cat.sig[id] && cat.kitTracks.every(t=>o[t]>=cat.kitSigNeed); s.kit[id]=o; }
  const ros=(p.crew && Array.isArray(p.crew.roster) ? p.crew.roster : []).map(m=>m&&m.id).filter(id=>cat.crew[id]); s.crew=uniq([...s.crew, ...ros]);
  for(const [k,n] of Object.entries(p.ammo||{})) if(cat.ammo[k]) s.ammo[k]=int(n,0,99);
  return s; }
const afford=(s,c)=>(!c.c||s.coins>=c.c) && (!c.d||s.diamonds>=c.d);
const fail=e=>({ ok:false, err:e });
// one purchase against state s (mutated in place on success); r = { type, id, track? }
export function purchase(s, r, cat){ r=r||{}; let cost=null, grant=null; const id=String(r.id||'');
  switch(r.type){
    case 'gun':  if(!cat.guns[id]) return fail('unknown'); if(s.guns.includes(id)) return fail('owned'); cost=cat.guns[id]; grant=()=>s.guns.push(id); break;
    case 'tank': if(!cat.tanks[id]) return fail('unknown'); if(s.tanks.includes(id)) return fail('owned'); cost=cat.tanks[id]; grant=()=>s.tanks.push(id); break;
    case 'up': { const costs=cat.upgrades[id]; if(!costs) return fail('unknown'); const L=s.upgrades[id]|0; if(L>=costs.length) return fail('max'); cost=costs[L]; grant=()=>{ s.upgrades[id]=L+1; }; break; }
    case 'kit': { if(!s.tanks.includes(id) || !cat.kit[id]) return fail('not-owned'); if(!cat.kitTracks.includes(r.track)) return fail('unknown'); const k=s.kit[id]||{}; const L=k[r.track]|0; if(L>=cat.kitMax) return fail('max');
      cost=cat.kit[id][L]; grant=()=>{ k[r.track]=L+1; k.sig=!!k.sig; s.kit[id]=k; }; break; }
    case 'sig': { if(!s.tanks.includes(id) || !cat.sig[id]) return fail('unknown'); const k=s.kit[id]||{}; if(k.sig) return fail('owned'); if(!cat.kitTracks.every(t=>(k[t]|0)>=cat.kitSigNeed)) return fail('locked');
      cost={ d:cat.sig[id].d }; grant=()=>{ k.sig=true; s.kit[id]=k; }; break; }
    case 'crew': { const R=cat.crew[id]; if(!R || !R.price) return fail('unknown'); if(s.crew.includes(id)) return fail('owned'); cost=R.price; grant=()=>s.crew.push(id); break; }
    case 'ammo': { const A=cat.ammo[id]; if(!A) return fail('unknown'); if((s.ammo[id]|0)>=99) return fail('max'); cost=A.price; grant=()=>{ s.ammo[id]=Math.min(99,(s.ammo[id]|0)+A.box); }; break; }
    default: return fail('bad-type'); }
  if(!cost || !afford(s,cost)) return fail('funds');
  s.coins-=cost.c||0; s.diamonds-=cost.d||0; grant(); return { ok:true, cost }; }
// a finished run reports what it earned; the server pays from two token buckets (coins, diamonds) that refill with server time:
// a burst (a boss, a fortress) is paid in full, but the average can't beat coinPerMin / diaPerMin. A stage clear adds its own bonus allowance.
export function payout(s, rep, nowMs, cat){ rep=rep||{}; const C=cat.cap, m=s.meta||(s.meta={}), loop=int(rep.loop,0,50), lm=1+loop*C.loopMul;
  const mins=Math.max(0, (nowMs-(m.bucketAt||m.createdAt||nowMs))/60000);
  let bc=m.bucketC??C.coinBucket, bd=m.bucketD??C.diaBucket; bc=Math.min(C.coinBucket*lm, bc+C.coinPerMin*lm*mins); bd=Math.min(C.diaBucket, bd+C.diaPerMin*mins);
  let clears=rep.cleared?1:0; if(clears && m.lastClearAt && nowMs-m.lastClearAt < C.minClearGap*1000) clears=0;
  const capC=Math.floor(bc + C.coinPerClear*lm*clears), capD=Math.floor(bd + (C.diaPerClear+loop)*clears);
  const wantC=int(rep.coins,0,1e7), wantD=int(rep.diamonds,0,1e5), c=Math.min(wantC,capC), d=Math.min(wantD,capD);
  s.coins+=c; s.diamonds+=d; m.bucketC=Math.max(0, bc+C.coinPerClear*lm*clears-c); m.bucketD=Math.max(0, bd+(C.diaPerClear+loop)*clears-d); m.bucketAt=nowMs;
  for(const [k,n] of Object.entries(rep.ammoUsed||{})) if(s.ammo[k]) s.ammo[k]=Math.max(0, s.ammo[k]-int(n,0,99));
  let gun=null; if(clears || !m.lastGunAt || nowMs-m.lastGunAt >= C.gunGap*1000) for(const g of Array.isArray(rep.guns)?rep.guns:[]){ if(cat.guns[g] && cat.guns[g].c && !s.guns.includes(g)){ s.guns.push(g); gun=g; m.lastGunAt=nowMs; break; } }   // one battlefield find per report, never a VIP gun
  m.lastRunAt=nowMs; if(clears) m.lastClearAt=nowMs;
  return { coins:c, diamonds:d, gun, clamped:c<wantC||d<wantD, capC, capD }; }
