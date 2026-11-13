// functions/economy.js — Z162 the server's economy rules, pure (no Firebase): migrate a local save, validate a purchase, clamp a run's payout.
// Shared by index.js (Cloud Functions) and test.js. Prices come from catalog.json (built from the game's own data by tools/catalog.mjs).
const int=(v,lo,hi)=>Math.max(lo, Math.min(hi, Math.floor(Number(v)||0)));
const uniq=a=>[...new Set(a)];
export function freshState(){ return { coins:0, diamonds:0, guns:['rifle'], tanks:['lqt'], upgrades:{}, kit:{}, crew:['d_cmd','d_gun','d_drv','d_ldr'], ammo:{}, meta:{} }; }
const coinsOf=c=>!c?0:(c.c||0)+(c.d||0)*200;   // diamonds valued at 200 coins
export function inventoryValue(s, cat){ let v=0; for(const g of s.guns) v+=coinsOf(cat.guns[g]); for(const t of s.tanks) v+=coinsOf(cat.tanks[t]);
  for(const [k,L] of Object.entries(s.upgrades)) for(let i=0;i<L;i++) v+=coinsOf(cat.upgrades[k][i]);
  for(const [id,k] of Object.entries(s.kit)){ for(const t of cat.kitTracks) for(let i=0;i<(k[t]|0);i++) v+=coinsOf(cat.kit[id][i]); if(k.sig) v+=coinsOf({ d:cat.sig[id].d }); }
  for(const id of s.crew) v+=coinsOf(cat.crew[id]&&cat.crew[id].price); return v; }
// first contact: what the device already had comes across — only during the migration window, unknown items dropped, levels clamped,
// and the whole lot (wallet + inventory) worth at most migrateValue coins; a save beyond that is not credible → a fresh start
export function migrate(p, cat, nowMs){ p=p&&typeof p==='object'?p:{}; const s=freshState();
  if(nowMs!=null && nowMs>cat.cap.migrateUntil){ s.meta={ reach:0 }; return s; }
  s.coins=int(p.coins,0,cat.cap.migrateCoins); s.diamonds=int(p.diamonds,0,cat.cap.migrateDia);
  s.guns=uniq(['rifle', ...(Array.isArray(p.ownedGuns)?p.ownedGuns:[]).filter(g=>cat.gunIds.includes(g))]);
  s.tanks=uniq(['lqt', ...(Array.isArray(p.ownedTanks)?p.ownedTanks:[]).filter(t=>Object.prototype.hasOwnProperty.call(cat.tanks,t))]);
  for(const [k,L] of Object.entries(p.upgrades||{})) if(cat.upgrades[k]) s.upgrades[k]=int(L,0,cat.upgrades[k].length);
  for(const [id,k] of Object.entries(p.kit||{})) if(cat.kit[id] && s.tanks.includes(id) && k && typeof k==='object'){ const o={}; for(const t of cat.kitTracks) o[t]=int(k[t],0,cat.kitMax); o.sig=!!k.sig && !!cat.sig[id] && cat.kitTracks.every(t=>o[t]>=cat.kitSigNeed); s.kit[id]=o; }
  const ros=(p.crew && Array.isArray(p.crew.roster) ? p.crew.roster : []).map(m=>m&&m.id).filter(id=>cat.crew[id]); s.crew=uniq([...s.crew, ...ros]);
  for(const [k,n] of Object.entries(p.ammo||{})) if(cat.ammo[k]) s.ammo[k]=int(n,0,99);
  s.meta={ reach:int(((p.campaign&&p.campaign.max)|0)-1, 0, cat.cap.migrateReach) };   // levels cleared, as far as the server is concerned
  const inv=inventoryValue(s, cat); if(inv>cat.cap.migrateValue){ const f=freshState(); f.meta={ reach:0 }; f.meta.rejected=inv; return f; }
  s.coins=Math.min(s.coins, cat.cap.migrateValue-inv); s.diamonds=Math.min(s.diamonds, Math.floor((cat.cap.migrateValue-inv-s.coins)/200)+20);
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
export function payout(s, rep, nowMs, cat){ rep=rep||{}; const C=cat.cap, m=s.meta||(s.meta={});
  // progress is the SERVER's: a clear counts only for the next level (or one already reached), at most once per minClearGap; the NG+ multiplier follows the server's reach
  const reach=m.reach|0, lvl=int(rep.loop,0,50)*5+int(rep.stage,1,5);   // level being played (1-based)
  let clears=rep.cleared && lvl<=reach+1 && !(m.lastClearAt && nowMs-m.lastClearAt < C.minClearGap*1000) ? 1 : 0;
  const loop=Math.min(int(rep.loop,0,50), Math.floor(reach/5)), lm=1+loop*C.loopMul;
  const mins=Math.max(0, (nowMs-(m.bucketAt||m.createdAt||nowMs))/60000);
  let bc=m.bucketC??C.coinBucket, bd=m.bucketD??C.diaBucket; bc=Math.min(C.coinBucket, bc+C.coinPerMin*lm*mins); bd=Math.min(C.diaBucket, bd+C.diaPerMin*mins);
  const capC=Math.floor(bc + C.coinPerClear*lm*clears), capD=Math.floor(bd + (C.diaPerClear+loop)*clears);
  const wantC=int(rep.coins,0,1e7), wantD=int(rep.diamonds,0,1e5), c=Math.min(wantC,capC), d=Math.min(wantD,capD);
  s.coins+=c; s.diamonds+=d; m.bucketC=Math.max(0, bc+C.coinPerClear*lm*clears-c); m.bucketD=Math.max(0, bd+(C.diaPerClear+loop)*clears-d); m.bucketAt=nowMs;
  for(const [k,n] of Object.entries(rep.ammoUsed||{})) if(s.ammo[k]) s.ammo[k]=Math.max(0, s.ammo[k]-int(n,0,99));
  let gun=null; if(clears && !(m.lastGunAt && nowMs-m.lastGunAt < C.gunGap*1000)) for(const g of Array.isArray(rep.guns)?rep.guns:[]){ const pr=cat.guns[g]; if(pr && pr.c && pr.c<=C.gunPerReach*(lvl+1) && !s.guns.includes(g)){ s.guns.push(g); gun=g; m.lastGunAt=nowMs; break; } }   // a battlefield find: only with a validated stage clear, one per clear, priced within what that level drops, never VIP
  m.lastRunAt=nowMs; if(clears){ m.lastClearAt=nowMs; m.reach=Math.max(reach, lvl); }
  return { coins:c, diamonds:d, gun, clamped:c<wantC||d<wantD, capC, capD, clears, lvl:Math.min(lvl, (m.reach|0)+1) }; }

// Z163 LEADERBOARD — the week a moment belongs to, in Vietnam time (ISO week: Monday start), e.g. "2026-W46"
export function weekKey(ms){ const d=new Date(ms+7*3600e3); const day=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day+3);
  const y=d.getUTCFullYear(), w1=new Date(Date.UTC(y,0,4)), wk=1+Math.round(((d-w1)/864e5-3+((w1.getUTCDay()+6)%7))/7); return y+'-W'+String(wk).padStart(2,'0'); }
// a run's score as the server believes it: each report may only add what its score bucket allows (plus a bonus on a validated clear)
export function scoreUpdate(s, rep, nowMs, cat, clears, lvl){ const C=cat.cap, m=s.meta||(s.meta={}), runId=String(rep.runId||'').slice(0,40);
  if(!runId) return { changed:false };
  if(m.runId!==runId){ m.runId=runId; m.runScore=0; m.runSeen=0; }
  const mins=Math.max(0, (nowMs-(m.scoreAt||m.createdAt||nowMs))/60000), lm=1+Math.floor((m.reach|0)/5)*C.loopMul;
  const bucket=Math.min(C.scoreBucket*lm, (m.scoreB??C.scoreBucket)+C.scorePerMin*lm*mins), bonus=clears ? C.scorePerClear*Math.max(1,lvl|0) : 0;
  const claimed=int(rep.score,0,1e9), delta=Math.max(0, claimed-(m.runSeen|0)), take=Math.min(delta, bucket+bonus);
  m.runSeen=Math.max(m.runSeen|0, claimed); m.runScore=(m.runScore|0)+take; m.scoreB=Math.max(0, bucket+bonus-take); m.scoreAt=nowMs;
  const wk=weekKey(nowMs); if(m.week!==wk){ m.week=wk; m.weekBest=0; }
  let changed=false, weekChanged=false;
  if(m.runScore>(m.best|0)){ m.best=m.runScore; m.bestLvl=lvl|0; changed=true; }
  if(m.runScore>(m.weekBest|0)){ m.weekBest=m.runScore; m.weekLvl=lvl|0; weekChanged=true; }
  return { changed, weekChanged, week:wk, runScore:m.runScore, best:m.best|0, weekBest:m.weekBest|0, clamped:take<delta }; }
export function cleanName(n, uid){ const t=String(n||'').replace(/[<>&"'`\\]/g,'').replace(/\s+/g,' ').trim().slice(0,16); return t || ('CHỈ HUY '+String(uid||'').slice(0,4).toUpperCase()); }
