// ui/deploy.js — Z105 DEPLOYMENT before every stage: troop strength, key points to post men at, how many ride the tank,
//   specialists (MG / mortar / sapper), the tank's guns & ammo and a map of the field. Confirm → men spawn at their posts.
import { DEPLOY, TROOPS } from '../../config.js';
import { ARENA, DEPOTS, GUNS, MOBILE, POWS, PROFILE, RALLY_PT, RIDER, RIDGES, S, SPELLS, clampFieldXZ, clearFireteam, clearRiders, core, crewTarget, deployRiders, escapeHtml, fieldOutline, gunLevel, hide, iconEl, magCap, saveProfile, sfx, show, spawnAlly, tapEl, tip } from '../hub.js';

export let _dp=null;   // { posts:[...], roles:{mg,mortar,sapper}, total, onGo }
export function squadWant(){ const F=TROOPS.fireteam; return Math.min(MOBILE?F.capMobile:F.cap, Math.round(F.size+(S.stage-1)*F.perStage)); }
// the key points of this field (built from the planned zones): where a squad can be posted at the start
export function deployPosts(){ const p=S.player, sx=p?p.pos.x:0, sz=p?p.pos.z:ARENA*0.55, toward=(x,z,f)=>[sx+(x-sx)*f, sz+(z-sz)*f], posts=[];
  posts.push({ id:'tank', ic:'tank', nm:'ĐI CÙNG XE TĂNG', ds:'Ngồi trên nóc xe, hồi máu dần · thả xuống khi cần', max:RIDER.cap, cls:'tank' });
  if(core) posts.push({ id:'core', ic:'bunker', nm:'GIỮ LÕI', ds:'Phòng thủ quanh Lõi', x:core.pos.x, z:core.pos.z+6, max:6 });
  if(RALLY_PT.g) posts.push({ id:'rally', ic:'spark', nm:'KHU TẬP KẾT', ds:'Canh đồ & tiếp tế, sát xuất phát', x:RALLY_PT.x, z:RALLY_PT.z, max:4 });
  const side=w=>w.x<-ARENA*0.3?'TRÁI':(w.x>ARENA*0.3?'PHẢI':'PHÍA SAU'), dup=k=>POWS.filter(o=>side(o)===k).length>1;
  POWS.forEach((w,i)=>{ const [x,z]=toward(w.x, w.z, DEPLOY.stage), sd=side(w); posts.push({ id:'pow'+i, ic:'team', nm:'TRẠI GIAM '+sd+(dup(sd)?' '+(POWS.filter(o=>side(o)===sd).indexOf(w)+1):''), ds:'Áp sát, diệt lính canh, giải cứu tù binh', x, z, max:6, cls:'enemy', site:w }); });
  DEPOTS.forEach((d,i)=>{ const [x,z]=toward(d.x, d.z, DEPLOY.stage); posts.push({ id:d.kind+i, ic:d.kind==='arms'?'rifle':'tank', nm:d.kind==='arms'?'KHO VŨ KHÍ':'KHO XE TĂNG', ds:d.kind==='arms'?'Chiếm kho → súng chống tăng':'Chiếm bãi xe → lính lái xe địch', x, z, max:6, cls:'enemy', site:d }); });
  for(const sd of [-1,1]){ const [fx,fz]=clampFieldXZ(sd*ARENA*0.5, ARENA*0.12, 14); posts.push({ id:sd<0?'left':'right', ic:'target', nm:sd<0?'CÁNH TRÁI':'CÁNH PHẢI', ds:'Giữ sườn, chặn bộ binh vòng sau', x:fx, z:fz, max:5 }); }
  return posts; }
function roleMax(k){ const a=DEPLOY.roleMax[k]; return a[Math.min(a.length-1, S.stage-1)]; }
function assigned(){ return _dp.posts.reduce((n,q)=>n+q.n,0); }
// sensible default: crew on the tank, a pair at each enemy site, the rest split between the core and the rally point
export function autoDeploy(){ const D=_dp; let left=D.total; for(const q of D.posts) q.n=0;
  const put=(q,n)=>{ const k=Math.max(0, Math.min(n, q.max, left)); q.n+=k; left-=k; };
  put(D.posts.find(q=>q.id==='tank'), Math.min(crewTarget(), RIDER.cap));
  for(const q of D.posts) if(q.site) put(q, 2);
  const c=D.posts.find(q=>q.id==='core'), r=D.posts.find(q=>q.id==='rally'); while(left>0){ const b=left; if(c) put(c,1); if(r) put(r,1); for(const q of D.posts) if(q.id==='left'||q.id==='right') put(q,1); if(left===b) break; }
  D.roles={ mg:Math.min(1,roleMax('mg')), mortar:Math.min(1,roleMax('mortar')), sapper:Math.min(1,roleMax('sapper')) }; render(); }
export function openDeploy(onGo){
  const posts=deployPosts().map(q=>Object.assign(q,{ n:0 })), total=Math.min(RIDER.cap, crewTarget()) + squadWant();
  _dp={ posts, roles:{ mg:0, mortar:0, sapper:0 }, total, onGo }; S.mode='deploy';
  const mem=PROFILE.deploy; if(mem && mem.v===1){ let left=total; for(const q of posts){ const k=Math.max(0, Math.min(q.max, mem.posts[q.id.replace(/\d+$/,'')]||0, left)); q.n=k; left-=k; }
    for(const k of ['mg','mortar','sapper']) _dp.roles[k]=Math.min(roleMax(k), mem.roles[k]||0); render(); }
  else autoDeploy();
  document.getElementById('dp-op').textContent='BỐ TRÍ TRẬN ĐỊA · MÀN '+S.stage;
  show('deploy'); sfx('powerup'); tip('deploy'); }
function stepper(get, set, max){ const w=document.createElement('div'); w.className='dp-step';
  const m=document.createElement('div'), v=document.createElement('div'), pl=document.createElement('div'); m.className=pl.className='s'; v.className='v'; m.textContent='−'; pl.textContent='+';
  const sync=()=>{ v.textContent=get(); m.classList.toggle('off', get()<=0); pl.classList.toggle('off', get()>=max() ); };
  tapEl(m, ()=>{ if(get()>0){ set(get()-1); sfx('click'); render(); } }); tapEl(pl, ()=>{ if(get()<max()){ set(get()+1); sfx('click'); render(); } });
  w.append(m,v,pl); sync(); return w; }
function render(){ const D=_dp; if(!D) return; const free=D.total-assigned(), onFoot=D.total-free-(D.posts.find(q=>q.id==='tank')||{n:0}).n;
  document.getElementById('dp-total').innerHTML='QUÂN SỐ <b>'+D.total+'</b> · trên xe '+(D.posts.find(q=>q.id==='tank')||{n:0}).n+' · bộ binh '+onFoot+(free>0?' · <span class="warn">chưa bố trí '+free+'</span>':'');
  const L=document.getElementById('dp-posts'); L.replaceChildren();
  for(const q of D.posts){ const row=document.createElement('div'); row.className='dp-row '+(q.cls||''); const ic=document.createElement('div'); ic.className='dp-ic'; ic.appendChild(iconEl(q.ic));
    const nm=document.createElement('div'); nm.className='dp-nm'; nm.innerHTML='<b>'+escapeHtml(q.nm)+'</b><span>'+escapeHtml(q.ds)+'</span>';
    row.append(ic, nm, stepper(()=>q.n, v=>{ q.n=v; }, ()=>Math.min(q.max, q.n+(D.total-assigned())))); L.appendChild(row); }
  const R=document.getElementById('dp-roles'); R.replaceChildren(); const onFootMax=()=>D.total-(D.posts.find(q=>q.id==='tank')||{n:0}).n;
  for(const [k,ic,nm,ds] of [['mg','rifle','SÚNG MÁY','nằm bắn loạt dài'],['mortar','target','CỐI','bắn vòng cầu vào cụm địch, tháp, trại'],['sapper','wrench','CÔNG BINH','gài thuốc nổ đánh sập tháp canh, nhà lính']]){
    const row=document.createElement('div'); row.className='dp-row'; const i=document.createElement('div'); i.className='dp-ic'; i.appendChild(iconEl(ic));
    const n=document.createElement('div'); n.className='dp-nm'; n.innerHTML='<b>'+nm+' <small style="color:var(--muted)">tối đa '+roleMax(k)+'</small></b><span>'+ds+'</span>';
    row.append(i, n, stepper(()=>D.roles[k], v=>{ D.roles[k]=v; }, ()=>Math.min(roleMax(k), D.roles[k]+Math.max(0, onFootMax()-(D.roles.mg+D.roles.mortar+D.roles.sapper))))); R.appendChild(row); }
  const G=document.getElementById('dp-guns'); G.replaceChildren(); const p=S.player;
  if(p) for(const inst of p.guns){ const g=GUNS[inst.id]; if(!g) continue; const r=document.createElement('div'); r.className='dp-gun';
    r.innerHTML='<b>'+escapeHtml(g.name)+(gunLevel(inst.id)>1?' ★'+gunLevel(inst.id):'')+'</b><span>'+Math.round(g.dmg)+' dmg · băng '+magCap(g)+' · nạp '+g.reload.toFixed(1)+'s</span>'; G.appendChild(r); }
  if(p){ const sp=SPELLS[S.spell]; if(sp){ const r=document.createElement('div'); r.className='dp-gun'; r.innerHTML='<b>KỸ NĂNG · '+escapeHtml(sp.vi||sp.name||'')+'</b><span>hồi '+sp.cd+'s</span>'; G.appendChild(r); } }
  drawDeployMap(); }
export function drawDeployMap(){ const D=_dp, c=document.getElementById('dp-map'); if(!c||!D) return; const x=c.getContext('2d'), W=c.width, s=(W/2-8)/ARENA, X=v=>W/2+v*s, Y=v=>W/2+v*s;
  x.clearRect(0,0,W,W); const O=fieldOutline(); x.save(); x.beginPath(); O.forEach(([px,pz],i)=> i ? x.lineTo(X(px),Y(pz)) : x.moveTo(X(px),Y(pz))); x.closePath();
  x.fillStyle='rgba(255,255,255,.05)'; x.fill(); x.clip(); x.fillStyle='rgba(255,80,60,.1)'; x.fillRect(X(-ARENA),Y(-ARENA),ARENA*2*s,ARENA*s); x.restore();   // Z106 the real fence line, enemy half tinted
  x.strokeStyle='rgba(255,255,255,.35)'; x.lineWidth=1.2; x.beginPath(); O.forEach(([px,pz],i)=> i ? x.lineTo(X(px),Y(pz)) : x.moveTo(X(px),Y(pz))); x.closePath(); x.stroke();
  x.strokeStyle='rgba(200,190,170,.7)'; x.lineWidth=2; for(const R of RIDGES){ x.beginPath(); R.pts.forEach(([px,pz],i)=> i ? x.lineTo(X(px),Y(pz)) : x.moveTo(X(px),Y(pz))); x.stroke(); }
  for(const w of POWS){ x.strokeStyle='#ffcf5a'; x.lineWidth=1.5; x.beginPath(); x.moveTo(X(w.x),Y(w.z)-5); x.lineTo(X(w.x)+5,Y(w.z)); x.lineTo(X(w.x),Y(w.z)+5); x.lineTo(X(w.x)-5,Y(w.z)); x.closePath(); x.stroke(); }
  for(const d of DEPOTS){ x.strokeStyle='#ff6a4a'; x.lineWidth=1.5; x.strokeRect(X(d.x)-4,Y(d.z)-4,8,8); }
  if(core){ x.fillStyle='#6fe0ff'; x.beginPath(); x.arc(X(core.pos.x),Y(core.pos.z),3.5,0,7); x.fill(); }
  const p=S.player; if(p){ x.fillStyle='#bfe66a'; x.beginPath(); x.arc(X(p.pos.x),Y(p.pos.z),3.5,0,7); x.fill(); }
  x.font='bold 10px sans-serif'; x.textAlign='center'; x.textBaseline='middle';
  for(const q of D.posts){ if(q.x==null || !q.n) continue; x.fillStyle='#9be04a'; x.beginPath(); x.arc(X(q.x),Y(q.z),7,0,7); x.fill(); x.fillStyle='#14200a'; x.fillText(String(q.n), X(q.x), Y(q.z)+0.5); } }
// confirm: crew the hull, put every posted man at his post with his kit, remember the plan for next time
export function confirmDeploy(){ const D=_dp; if(!D) return; _dp=null; hide('deploy');
  clearFireteam(); clearRiders(); const tank=D.posts.find(q=>q.id==='tank'); if(tank && tank.n) deployRiders(tank.n);
  const roles=[]; for(const k of ['mg','mortar','sapper']) for(let i=0;i<D.roles[k];i++) roles.push(k);
  for(const q of D.posts){ if(q.id==='tank' || !q.n) continue; for(let i=0;i<q.n;i++){ const a=Math.random()*6.283, r=1.5+Math.random()*3.5;
      const al=spawnAlly(q.x+Math.cos(a)*r, q.z+Math.sin(a)*r, Math.PI, roles.length ? roles.shift() : 'rifle'); al.hold=[q.x, q.z]; al.kbx=al.kbz=0; } }
  S.roleQueue=roles;                                                         // specialists left over → the next men to jump off the tank
  const mem={ v:1, posts:{}, roles:D.roles }; for(const q of D.posts){ const k=q.id.replace(/\d+$/,''); mem.posts[k]=(mem.posts[k]||0)+q.n; } PROFILE.deploy=mem; saveProfile();
  sfx('levelup'); if(D.onGo) D.onGo(); }
{ const go=document.getElementById('dp-go'), au=document.getElementById('dp-auto'); if(go) tapEl(go, confirmDeploy); if(au) tapEl(au, ()=>{ if(_dp){ autoDeploy(); sfx('click'); } });
  addEventListener('keydown', e=>{ if(S.mode==='deploy' && e.key==='Enter'){ e.preventDefault(); confirmDeploy(); } }); }
