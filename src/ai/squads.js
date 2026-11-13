// ai/squads.js — Z173 SQUAD TACTICS: enemy foot squads get a leader, a formation and one shared plan (advance → fire-and-manoeuvre with a flank → assault, or fall back when broken), suppression pins men down, squads escort tanks (the tank fixes you, the men flank), and a coarse nav grid routes them round fortress walls. Our fireteam fights in two alternating teams with focus fire and takes squad orders.
import { SQUAD_AI } from '../../config.js';
import { ARENA, BF, FT, S, blocks, coverSpot, enemies, enemyGroundStrike, floatText, inField, infTarget, radio, ringPulse, sfx } from '../hub.js';

export const SQUADS=[];
let _sid=0;
const R2=r=>r[0]+Math.random()*(r[1]-r[0]);
// a group of freshly spawned men becomes one squad (opt.escort: the tank they move with)
export function makeSquad(members, opt){ const live=members.filter(e=>e && e.def && e.def.inf); if(live.length<2) return null;
  const sq={ id:++_sid, m:live, leader:live[0], n0:live.length, state:'advance', t0:performance.now()/1000, thinkAt:0, swapAt:0, bound:0, flank:Math.random()<0.5?-1:1, flankA:0,
    morale:1, lost:false, escort:(opt&&opt.escort)||null, path:null, pathAt:0, pathGoal:null, fallAt:0 };
  live.forEach((e,i)=>{ e.sq=sq; e.ft=i%2; }); SQUADS.push(sq); return sq; }
export function clearSquads(){ SQUADS.length=0; SQNAV.g=null; FTSQ.focus=null; S.sqOrder='free'; }

// ================= SQNAV GRID (2.5 m cells): fortress walls, shut gates, buildings, rocks, towers — routes round them; small cover is passable =================
export const SQNAV={ cell:2.5, N:0, g:null, n0:-1, at:0, field:null, fKey:'' };
function navBuild(now){ if(SQNAV.g && blocks.length===SQNAV.n0 && now<SQNAV.at) return; SQNAV.n0=blocks.length; SQNAV.at=now+2;
  const C=SQNAV.cell, N=Math.ceil(ARENA*2/C); SQNAV.N=N; const key=S.stage+'|'+N;
  if(SQNAV.fKey!==key || !SQNAV.field){ SQNAV.fKey=key; SQNAV.field=new Uint8Array(N*N); for(let j=0;j<N;j++) for(let i=0;i<N;i++){ const x=-ARENA+(i+0.5)*C, z=-ARENA+(j+0.5)*C; SQNAV.field[j*N+i]=inField(x,z,1)?0:1; } }
  const g=SQNAV.g && SQNAV.g.length===N*N ? SQNAV.g : (SQNAV.g=new Uint8Array(N*N)); g.set(SQNAV.field);
  for(const b of blocks){ const solid=b.kind==='fortwall'||b.kind==='gate'||b.kind==='tower'||b.kind==='camp'||b.kind==='parked'||b.steel||b.hard||b.obb||(b.r||0)>=2.2; if(!solid) continue;
    const r=(b.obb ? Math.hypot(b.obb.hl, b.obb.hw) : b.r)+0.5, i0=Math.max(0,Math.floor((b.x-r+ARENA)/C)), i1=Math.min(N-1,Math.floor((b.x+r+ARENA)/C)), j0=Math.max(0,Math.floor((b.z-r+ARENA)/C)), j1=Math.min(N-1,Math.floor((b.z+r+ARENA)/C));
    for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const x=-ARENA+(i+0.5)*C, z=-ARENA+(j+0.5)*C;
      if(b.obb){ const s_=Math.sin(b.obb.f), c_=Math.cos(b.obb.f), dx=x-b.x, dz=z-b.z, al=dx*s_+dz*c_, ac=dx*c_-dz*s_; if(Math.abs(al)<b.obb.hl+0.6 && Math.abs(ac)<b.obb.hw+0.6) g[j*N+i]=1; }
      else if((x-b.x)**2+(z-b.z)**2 < r*r) g[j*N+i]=1; } } }
const _cellOf=(x)=>Math.floor((x+ARENA)/SQNAV.cell);
function navFree(i,j){ const N=SQNAV.N; return i>=0 && j>=0 && i<N && j<N && !SQNAV.g[j*N+i]; }
function navNearFree(i,j){ if(navFree(i,j)) return [i,j]; for(let r=1;r<=4;r++) for(let dj=-r;dj<=r;dj++) for(let di=-r;di<=r;di++){ if(Math.max(Math.abs(di),Math.abs(dj))!==r) continue; if(navFree(i+di,j+dj)) return [i+di,j+dj]; } return null; }
function losClear(x0,z0,x1,z1){ const d=Math.hypot(x1-x0,z1-z0), n=Math.ceil(d/1.2); for(let k=1;k<n;k++){ const t=k/n; if(!navFree(_cellOf(x0+(x1-x0)*t), _cellOf(z0+(z1-z0)*t))) return false; } return true; }
let _gS=null, _came=null, _stamp=null, _gen=0; const _heap=[];
// A* on the grid → smoothed waypoints [[x,z],…] (null if no route within the node budget)
export function navPath(x0, z0, x1, z1, now){ navBuild(now||performance.now()/1000); const N=SQNAV.N, C=SQNAV.cell;
  if(losClear(x0,z0,x1,z1)) return [[x1,z1]];
  const s=navNearFree(_cellOf(x0),_cellOf(z0)), t=navNearFree(_cellOf(x1),_cellOf(z1)); if(!s||!t) return null;
  if(!_gS || _gS.length!==N*N){ _gS=new Float32Array(N*N); _came=new Int32Array(N*N); _stamp=new Uint32Array(N*N); }
  _gen++; const si=s[1]*N+s[0], ti=t[1]*N+t[0], tx=t[0], tz=t[1]; _heap.length=0; _gS[si]=0; _came[si]=-1; _stamp[si]=_gen; _heap.push([Math.hypot(s[0]-tx,s[1]-tz), si]);
  const push=(f,i)=>{ _heap.push([f,i]); let k=_heap.length-1; while(k>0){ const p=(k-1)>>1; if(_heap[p][0]<=_heap[k][0]) break; [_heap[p],_heap[k]]=[_heap[k],_heap[p]]; k=p; } };
  const pop=()=>{ const top=_heap[0], last=_heap.pop(); if(_heap.length){ _heap[0]=last; let k=0; for(;;){ const l=2*k+1, r=l+1; let m=k; if(l<_heap.length && _heap[l][0]<_heap[m][0]) m=l; if(r<_heap.length && _heap[r][0]<_heap[m][0]) m=r; if(m===k) break; [_heap[m],_heap[k]]=[_heap[k],_heap[m]]; k=m; } } return top; };
  let found=false, budget=SQUAD_AI.navBudget;
  while(_heap.length && budget-->0){ const [,ci]=pop(); if(ci===ti){ found=true; break; } const ci_=ci%N, cj=(ci/N)|0, g0=_gS[ci];
    for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){ if(!di&&!dj) continue; const ni=ci_+di, nj=cj+dj; if(!navFree(ni,nj)) continue; if(di&&dj && (!navFree(ci_+di,cj) || !navFree(ci_,cj+dj))) continue;   // no corner cutting
      const k=nj*N+ni, g=g0+(di&&dj?1.414:1); if(_stamp[k]===_gen && _gS[k]<=g) continue; _stamp[k]=_gen; _gS[k]=g; _came[k]=ci; push(g+Math.hypot(ni-tx,nj-tz), k); } }
  if(!found) return null;
  const raw=[]; for(let k=ti;k!==-1;k=_came[k]) raw.push([-ARENA+((k%N)+0.5)*C, -ARENA+(((k/N)|0)+0.5)*C]); raw.reverse(); raw[raw.length-1]=[x1,z1];
  const out=[]; let ax=x0, az=z0, i=0; while(i<raw.length){ let j=raw.length-1; while(j>i && !losClear(ax,az,raw[j][0],raw[j][1])) j--; out.push(raw[j]); ax=raw[j][0]; az=raw[j][1]; i=j+1; }   // string-pull
  return out; }

// ================= SUPPRESSION =================
// a round that passes close: the man flinches toward the ground (k ≈ how heavy the fire is)
export function suppress(u, k){ u.supp=Math.min(1, (u.supp||0)+k); }

// ================= ENEMY SQUADS =================
function squadThink(sq, now){
  sq.m=sq.m.filter(e=>enemies.includes(e) && !e.dead); if(!sq.m.length) return false;
  if(!sq.m.includes(sq.leader)){ sq.leader=sq.m[0]; sq.lost=true; sq.morale-=0.25; floatText('HẠ TỐP TRƯỞNG', '#ffcf5a', { x:sq.leader.pos.x, y:2.6, z:sq.leader.pos.z }, 13); }
  const L=sq.leader, n=sq.m.length; let cx=0, cz=0, sp=0; for(const e of sq.m){ cx+=e.pos.x; cz+=e.pos.z; sp+=e.supp||0; } cx/=n; cz/=n; sp/=n;
  const A=SQUAD_AI, T=infTarget(L); sq.T=T; const tx=T.pos.x, tz=T.pos.z, d=Math.hypot(tx-cx, tz-cz)||1, ux=(tx-cx)/d, uz=(tz-cz)/d, R=L.def.range||24;
  sq.morale=Math.max(0, Math.min(1, n/sq.n0 + (sq.lost?-0.15:0) - sp*0.25 + (sq.rally||0)));
  const esc=sq.escort && enemies.includes(sq.escort) ? sq.escort : null; if(sq.escort && !esc) sq.escort=null;
  let st=sq.state;
  if(st==='fallback'){ if(now>sq.fallAt && sp<0.3){ sq.rally=(sq.rally||0)+0.35; st='advance'; } }
  else if(sq.morale<A.breakMorale && n<sq.n0){ st='fallback'; sq.fallAt=now+R2(A.rallyT); floatText('ĐỊCH RÚT LUI', '#9be04a', { x:cx, y:2.8, z:cz }, 14); }
  else if(esc && d>R+8) st='escort';
  else if(d>R+10) st='advance';
  else if(d<A.assaultR || (T.tank===false && n>=3 && d<R*0.7)) st='assault';
  else st='fm';
  if(st!==sq.state){ sq.state=st; sq.path=null; if(st==='fm'){ sq.swapAt=now+R2(A.boundT); sq.bound=0; } }
  // — per-man orders —
  const set=(e,g,stance,noFire,fk)=>{ e.sqGoal=g; e.sqStance=stance||null; e.sqNoFire=!!noFire; e.sqFireK=fk||1; };
  if(st==='fallback'){ for(const e of sq.m){ set(e, [e.pos.x-ux*14+(Math.random()-0.5)*4, e.pos.z-uz*14+(Math.random()-0.5)*4], null, false, 1.6); } return true; }
  if(st==='escort'){ const fx=Math.sin(esc.facing||0), fz=Math.cos(esc.facing||0); sq.m.forEach((e,i)=>{ const side=(i%2?1:-1)*(1.6+((i>>1)%3)*1.6), back=5+((i>>1)%3)*2.2;   // two files behind the tank
      set(e, [esc.pos.x-fx*back+fz*side, esc.pos.z-fz*back-fx*side], null, false, 1); }); return true; }
  if(st==='advance'){ // the leader walks the route; the others hold a wedge on him
    if(!sq.path || now>sq.pathAt || (sq.pathGoal && Math.hypot(sq.pathGoal[0]-tx, sq.pathGoal[1]-tz)>8)){ const gx=tx-ux*R*0.85, gz=tz-uz*R*0.85; sq.path=navPath(L.pos.x, L.pos.z, gx, gz, now); sq.pathGoal=[tx,tz]; sq.pathAt=now+2.5; }
    let wp=null; if(sq.path){ while(sq.path.length>1 && Math.hypot(sq.path[0][0]-L.pos.x, sq.path[0][1]-L.pos.z)<3) sq.path.shift(); wp=sq.path[0]; }
    if(!wp) wp=[tx-ux*R*0.85, tz-uz*R*0.85]; set(L, wp, null, false, 1);
    const h=Math.atan2(wp[0]-L.pos.x, wp[1]-L.pos.z), hx=Math.sin(h), hz=Math.cos(h); let k=0;
    for(const e of sq.m){ if(e===L) continue; k++; const row=(k+1)>>1, side=(k%2?1:-1)*row*A.spacing, back=row*A.spacing;   // wedge
      set(e, [L.pos.x-hx*back+hz*side, L.pos.z-hz*back-hx*side], null, false, 1); } return true; }
  if(st==='assault'){ for(const e of sq.m){ const ox=e.pos.x-tx, oz=e.pos.z-tz, od=Math.hypot(ox,oz)||1, keep=e.def.rpg?14:6; set(e, [tx+ox/od*keep, tz+oz/od*keep], null, false, 0.8); } return true; }
  // FIRE AND MANOEUVRE: one team lies down and shoots (suppression), the other bounds cover-to-cover round a flank; then they swap
  if(now>sq.swapAt && sp<0.7){ sq.bound^=1; sq.swapAt=now+R2(A.boundT); sq.flankA=Math.min(A.flankMax, sq.flankA+A.flankStep); }
  const base=Math.atan2(cx-tx, cz-tz)+sq.flank*sq.flankA, fx=tx+Math.sin(base)*R*0.75, fz=tz+Math.cos(base)*R*0.75;   // where the bounding team is working round to
  for(const e of sq.m){
    if(e.def.rpg && T.tank){ const pa=Math.atan2(cx-tx, cz-tz)+sq.flank*1.35, rr=(e.def.range||30)*0.72; set(e, [tx+Math.sin(pa)*rr, tz+Math.cos(pa)*rr], 'crouch', false, 1); continue; }   // the RPG team goes for the flank of the tank
    if(e.ft===sq.bound && (e.supp||0)<0.8){ const bx=fx-e.pos.x, bz=fz-e.pos.z, bd=Math.hypot(bx,bz)||1, step=Math.min(bd, A.boundStep), gx=e.pos.x+bx/bd*step, gz=e.pos.z+bz/bd*step;
      const cv=coverSpot(gx, gz, tx, tz, 5); if(!e.sqGoal || e.sqBound!==sq.swapAt){ e.sqBound=sq.swapAt; set(e, cv?[cv.x,cv.z]:[gx,gz], null, true, 1); } }
    else set(e, null, (e.supp||0)>0.4 || d>R*0.6 ? 'prone' : 'crouch', false, A.suppressFireK); }
  return true; }
export function updateSquads(dt, now){
  for(const e of enemies) if(e.supp) e.supp=Math.max(0, e.supp-dt*SQUAD_AI.suppDecay);
  for(const a of FT) if(a.supp) a.supp=Math.max(0, a.supp-dt*SQUAD_AI.suppDecay);
  for(let i=SQUADS.length-1;i>=0;i--){ const sq=SQUADS[i]; if(now<sq.thinkAt) continue; sq.thinkAt=now+SQUAD_AI.think*(0.85+Math.random()*0.3);
    if(!squadThink(sq, now)){ for(const e of sq.m) e.sq=null; SQUADS.splice(i,1); } }
  updateFTSquad(now); }
// the man's squad move for this frame: null = no squad order (use his own logic), {x,z,hold}
export function squadMove(e){ const sq=e.sq; if(!sq || e.exit || e.guard) return null; const g=e.sqGoal;
  if(!g) return { hold:true };
  const dx=g[0]-e.pos.x, dz=g[1]-e.pos.z, d=Math.hypot(dx,dz); if(d<0.9) return { hold:true };
  return { x:dx/d, z:dz/d, run: sq.state==='fallback' || sq.state==='assault' || e.sqNoFire, hold:false }; }

// ================= COMBINED ARMS: an escorted tank fixes you from range; a fresh wave can come as a pincer, a probe or behind a barrage =================
export function tankEscorted(t){ for(const sq of SQUADS) if(sq.escort===t && sq.m.length) return true; return false; }
export function prepBarrage(){ const p=S.player; if(!p) return; const B=BF.barrage, a=Math.random()*Math.PI*2, d0=-B.step*(B.shells/2);
  for(let i=0;i<B.shells+2;i++){ const d=d0+i*B.step, x=p.pos.x+Math.sin(a)*d+(Math.random()-0.5)*3, z=p.pos.z+Math.cos(a)*d+(Math.random()-0.5)*3;
    setTimeout(()=>{ if(S.mode==='playing') ringPulse({x,z}, 0xff3020, B.r); }, (0.4+i*B.gap)*1000);
    setTimeout(()=>{ if(S.mode==='playing') enemyGroundStrike(x, z, B.r, B.dmg*0.8, performance.now()/1000); }, (0.4+B.lead+i*B.gap*1.6)*1000); }
  radio('SCH: Pháo kích dọn đường! Chúng sắp xung phong — chạy ngang ra!'); }

// ================= OUR FIRETEAM: two teams (even / odd slots) alternate bounding and covering; one focus target; squad orders =================
export const FTSQ={ bound:0, swapAt:0, focus:null, focusAt:0 };
const ORDERS=['free','hold','push','left','right'], ORDER_TX={ free:'TỰ DO', hold:'GIỮ VỊ TRÍ', push:'TIẾN CÔNG', left:'VÒNG SƯỜN TRÁI', right:'VÒNG SƯỜN PHẢI' };
const ORDER_RADIO={ free:'Tổ bộ binh: rõ — tự do tác chiến!', hold:'Tổ bộ binh: rõ — giữ vị trí, bắn chặn!', push:'Tổ bộ binh: rõ — vận động tiến công, yểm trợ lẫn nhau!', left:'Tổ bộ binh: rõ — vòng sườn trái!', right:'Tổ bộ binh: rõ — vòng sườn phải!' };
export function cycleSquadOrder(){ if(S.mode!=='playing') return; const i=ORDERS.indexOf(S.sqOrder||'free'); S.sqOrder=ORDERS[(i+1)%ORDERS.length]; const p=S.player;
  for(const a of FT){ a.thinkAt=0; a.orderPos=[a.pos.x, a.pos.z]; } S.sqOrderAt=performance.now()/1000;
  floatText('LỆNH TỔ: '+ORDER_TX[S.sqOrder]+' · '+FT.length+' LÍNH', '#9be04a', p.pos, 17); radio(ORDER_RADIO[S.sqOrder]); sfx('click'); }
export function squadOrderLabel(){ return ORDER_TX[S.sqOrder||'free']; }
function updateFTSquad(now){ if(!FT.length){ FTSQ.focus=null; return; }
  if(now>FTSQ.swapAt){ FTSQ.bound^=1; FTSQ.swapAt=now+R2(SQUAD_AI.boundT); }
  if(now>FTSQ.focusAt){ FTSQ.focusAt=now+0.5; let cx=0, cz=0; for(const a of FT){ cx+=a.pos.x; cz+=a.pos.z; } cx/=FT.length; cz/=FT.length; FTSQ.cx=cx; FTSQ.cz=cz;
    let best=null, bs=-1e9; for(const e of enemies){ if(!e.def.inf || e.dead) continue; const d=Math.hypot(e.pos.x-cx, e.pos.z-cz); if(d>SQUAD_AI.focusR) continue;
      const s=(e.def.rpg?3:0)+(e.sq && e.sq.leader===e?1.5:0)+(e.elite?1:0)-d/12; if(s>bs){ bs=s; best=e; } }
    FTSQ.focus=best; } }
// where a man of ours wants to be under the current squad order (null = no say)
export function orderGoal(a, foe, now){ const o=S.sqOrder||'free'; if(o==='free') return null;
  if(o==='hold') return a.orderPos||null;
  let ex=0, ez=0, n=0; for(const e of enemies){ if(e.def.air) continue; const q=Math.hypot(e.pos.x-a.pos.x, e.pos.z-a.pos.z); if(q<SQUAD_AI.orderR){ ex+=e.pos.x; ez+=e.pos.z; n++; } }
  if(!n) return null; ex/=n; ez/=n; const p=S.player, ax=ex-p.pos.x, az=ez-p.pos.z, al=Math.hypot(ax,az)||1;
  if(o==='push'){ const dx=ex-a.pos.x, dz=ez-a.pos.z, dd=Math.hypot(dx,dz)||1; if(a.team!==FTSQ.bound || dd<15) return null; const g=[a.pos.x+dx/dd*Math.min(dd-12, 7), a.pos.z+dz/dd*Math.min(dd-12, 7)]; const cv=coverSpot(g[0], g[1], ex, ez, 5); return cv?[cv.x,cv.z]:g; }
  const side=o==='left'?1:-1, fx=ex+(-az/al)*side*SQUAD_AI.flankR - ax/al*6, fz=ez+(ax/al)*side*SQUAD_AI.flankR - az/al*6;   // left/right of the line from the tank to the enemy
  if(Math.hypot(fx-a.pos.x, fz-a.pos.z)<6) return null; return [fx+(a.slot%3-1)*2.5, fz+((a.slot/3|0)%3-1)*2.5]; }
