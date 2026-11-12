// ui/terrain-picker.js — Z103 split from ui/menus.js. TERRAIN PICKER — start-screen battlefield choice (AUTO campaign rotation or a fixed biome) with a live preview.
import { BIOMES, PROFILE, biomeVi, hide, openBattleSetup, saveProfile, sfx, show, tapBtn, tapEl } from '../hub.js';

// terrain picker (start screen): AUTO (campaign rotation) + every battlefield; persists in PROFILE.terrain
// start-screen summary button reflects the current pick
export function buildTerrainPicker(){
  const cur=(PROFILE.custom&&Number.isInteger(PROFILE.custom.biome))?PROFILE.custom.biome:0;   // Z107 shows the CUSTOM battle's map
  const name='TỰ CHỌN · '+biomeVi(BIOMES[cur].name), col=BIOMES[cur].ground;
  const nm=document.getElementById('tBtnName'), sw=document.getElementById('tBtnSw');
  if(nm) nm.textContent=name; if(sw) sw.style.background='#'+col.toString(16).padStart(6,'0');
}
// stylized perspective preview of a battlefield, drawn into a card's canvas
export function drawTerrainPreview(cv, b, isAuto){
  const w=cv.width, h=cv.height, x=cv.getContext('2d'), hex=c=>'#'+(c>>>0).toString(16).padStart(6,'0'), hz=Math.round(h*0.4);
  x.clearRect(0,0,w,h);
  let sky=x.createLinearGradient(0,0,0,hz); sky.addColorStop(0,hex(b.bg)); sky.addColorStop(1,hex(b.sky)); x.fillStyle=sky; x.fillRect(0,0,w,hz);
  const sunX=isAuto?w*0.5:w*0.64, sg=x.createRadialGradient(sunX,hz,2,sunX,hz,w*0.55); sg.addColorStop(0,hex(b.sun)); sg.addColorStop(.45,'rgba(0,0,0,0)');
  x.save(); x.globalAlpha=.55; x.fillStyle=sg; x.fillRect(0,0,w,hz+12); x.restore();
  x.fillStyle=hex(b.ground); x.fillRect(0,hz,w,h-hz);
  let gg=x.createLinearGradient(0,hz,0,h); gg.addColorStop(0,'rgba(0,0,0,.42)'); gg.addColorStop(.5,'rgba(0,0,0,.04)'); gg.addColorStop(1,'rgba(0,0,0,.26)'); x.fillStyle=gg; x.fillRect(0,hz,w,h-hz);
  x.strokeStyle=hex(b.grid); x.lineWidth=1; const cx=w/2; x.save(); x.globalAlpha=.42;   // converging perspective grid
  for(let i=-6;i<=6;i++){ x.beginPath(); x.moveTo(cx+i*7,hz); x.lineTo(cx+i*46,h); x.stroke(); }
  for(let i=1;i<=5;i++){ const t=i/5, yy=hz+(h-hz)*t*t; x.beginPath(); x.moveTo(0,yy); x.lineTo(w,yy); x.stroke(); } x.restore();
  if(!isAuto){ const deco=b.deco; for(let i=0;i<11;i++){ const t=Math.random(), persp=0.32+t, yy=hz+7+(h-hz-12)*t, px=Math.random()*w, s=(3+Math.random()*6)*persp;
    x.save(); x.translate(px,yy);
    if(deco==='grass'){ x.strokeStyle='#3f5f24'; x.lineWidth=1.4*persp; for(let k=-1;k<=1;k++){ x.beginPath(); x.moveTo(k*2*persp,0); x.lineTo(k*2*persp-1,-s*1.5); x.stroke(); } }
    else if(deco==='ice'){ x.fillStyle='rgba(198,240,255,.9)'; x.beginPath(); x.moveTo(0,-s*1.7); x.lineTo(s*.6,0); x.lineTo(-s*.6,0); x.closePath(); x.fill(); }
    else if(deco==='slag'){ x.fillStyle='#1c1814'; x.beginPath(); x.arc(0,-s*.4,s*.7,0,7); x.fill(); x.fillStyle='#ff5a1c'; x.beginPath(); x.arc(0,-s*.4,s*.22,0,7); x.fill(); }
    else { x.fillStyle=deco==='rubble'?'#5a564e':'#7a6a48'; x.beginPath(); x.moveTo(-s,0); x.lineTo(-s*.4,-s); x.lineTo(s*.5,-s*.8); x.lineTo(s,0); x.closePath(); x.fill(); }
    x.restore(); } }
  if(!isAuto){ const nm=b.name;   // Z139 the three newer maps get their own skyline
    if(nm==='CITY'){ for(let i=0;i<9;i++){ const bw=9+Math.random()*10, bh=14+Math.random()*(h*0.34), bx=6+i*(w-12)/9+Math.random()*4, by=hz+3; x.fillStyle=i%2?'#4a4e56':'#585c64'; x.fillRect(bx,by-bh,bw,bh+6);
        x.fillStyle='rgba(255,214,130,.85)'; for(let r=0;r<Math.floor(bh/6);r++) for(let k=0;k<2;k++) if(Math.random()<0.45) x.fillRect(bx+2+k*(bw/2-1),by-bh+3+r*6,2,2.4); } }
    else if(nm==='HILLS'){ x.fillStyle='#4a6a2e'; x.beginPath(); x.moveTo(0,hz+4); for(let i=0;i<=8;i++) x.quadraticCurveTo(i*w/8-w/16, hz-8-Math.random()*h*0.2, i*w/8, hz+4); x.closePath(); x.fill();
      x.fillStyle='#2f5a2c'; for(let i=0;i<14;i++){ const px=Math.random()*w, py=hz+4+Math.random()*(h-hz-8), s2=2.5+(py-hz)/12; x.beginPath(); x.moveTo(px,py-s2*2.2); x.lineTo(px+s2,py); x.lineTo(px-s2,py); x.closePath(); x.fill(); } }
    else if(nm==='SAVANNA'){ x.fillStyle='#d8b468'; for(let i=0;i<40;i++){ const px=Math.random()*w, py=hz+4+Math.random()*(h-hz-6); x.fillRect(px,py,1.2,-3-Math.random()*4); }   // Z143 golden grass, an acacia, a baobab, a herd
      x.fillStyle='#3a3020'; x.fillRect(w*0.7,hz-12,2,14); x.beginPath(); x.ellipse(w*0.7+1,hz-13,16,3.5,0,0,7); x.fill(); x.fillRect(w*0.22,hz-9,6,12); x.beginPath(); x.arc(w*0.22+3,hz-10,6,Math.PI,0); x.fill();
      for(let i=0;i<5;i++){ const px=w*0.42+i*6, py=hz+10+(i%2)*3; x.fillRect(px,py,4,2); x.fillRect(px,py+2,1,3); x.fillRect(px+3,py+2,1,3); } }
    else if(nm==='ARCTIC'){ x.fillStyle='#1a2a36'; x.beginPath(); x.moveTo(-4,hz+(h-hz)*0.6); x.bezierCurveTo(w*0.3,hz+(h-hz)*0.45,w*0.6,hz+(h-hz)*0.8,w+4,hz+(h-hz)*0.55); x.lineTo(w+4,hz+(h-hz)*0.68); x.bezierCurveTo(w*0.6,hz+(h-hz)*0.92,w*0.3,hz+(h-hz)*0.58,-4,hz+(h-hz)*0.72); x.closePath(); x.fill();
      x.fillStyle='#e8f4fc'; for(let i=0;i<5;i++){ x.beginPath(); x.moveTo(10+i*26,hz+2); x.lineTo(16+i*26,hz-10-Math.random()*8); x.lineTo(22+i*26,hz+2); x.closePath(); x.fill(); } }
    else if(nm==='VILLAGE'){ x.save(); x.strokeStyle='#4f9ec0'; x.lineCap='round'; x.lineWidth=11; x.beginPath(); x.moveTo(-6,hz+(h-hz)*0.55); x.bezierCurveTo(w*0.25,hz+(h-hz)*0.25,w*0.55,hz+(h-hz)*0.95,w+6,hz+(h-hz)*0.45); x.stroke();
      x.strokeStyle='rgba(255,255,255,.35)'; x.lineWidth=1.4; x.beginPath(); x.moveTo(-6,hz+(h-hz)*0.55-2); x.bezierCurveTo(w*0.25,hz+(h-hz)*0.25-2,w*0.55,hz+(h-hz)*0.95-2,w+6,hz+(h-hz)*0.45-2); x.stroke(); x.restore();
      x.fillStyle='#e6d8b8'; x.fillRect(w*0.12,hz+6,13,8); x.fillStyle='#b4562f'; x.beginPath(); x.moveTo(w*0.12-2,hz+6); x.lineTo(w*0.12+6.5,hz+1); x.lineTo(w*0.12+15,hz+6); x.closePath(); x.fill(); } }
  let vg=x.createRadialGradient(w/2,h/2,h*.2,w/2,h/2,w*.72); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.45)'); x.fillStyle=vg; x.fillRect(0,0,w,h);
  if(isAuto){ x.fillStyle='rgba(0,0,0,.36)'; x.fillRect(0,0,w,h);   // AUTO: rotate glyph overlay
    x.strokeStyle='#cfe6a0'; x.lineWidth=3.2; x.beginPath(); x.arc(w/2,h*.42,17,0.7,5.5); x.stroke();
    x.beginPath(); x.moveTo(w/2+15,h*.42-12); x.lineTo(w/2+21,h*.42-3); x.lineTo(w/2+10,h*.42-4); x.closePath(); x.fillStyle='#cfe6a0'; x.fill(); }
}
export function buildTerrainDialog(){
  const g=document.getElementById('terrainGallery'); if(!g) return; g.innerHTML='';
  const cur=(Number.isInteger(PROFILE.terrain)&&PROFILE.terrain>=-1)?PROFILE.terrain:-1;
  const opts=[{i:-1,name:'TỰ ĐỘNG',tag:'ĐỔI THEO MÀN',auto:true}].concat(BIOMES.map((b,i)=>({i,name:biomeVi(b.name),tag:'ĐỊA HÌNH',b})));
  for(const o of opts){
    const card=document.createElement('div'); card.className='tcard'+(o.i===cur?' on':''); card.dataset.i=o.i;
    const cv=document.createElement('canvas'); cv.width=192; cv.height=120; card.appendChild(cv);
    drawTerrainPreview(cv, o.auto?BIOMES[0]:o.b, !!o.auto);
    const nm=document.createElement('div'); nm.className='tc-name'; nm.innerHTML='<span>'+o.name+'</span><span class="tc-tag">'+o.tag+'</span>'; card.appendChild(nm);
    tapEl(card, ()=>{ PROFILE.terrain=o.i; saveProfile(); [...g.children].forEach(c=>c.classList.toggle('on', (+c.dataset.i)===o.i)); buildTerrainPicker(); sfx('click'); });
    g.appendChild(card);
  }
}
export function openTerrainDlg(){ hide('start'); buildTerrainDialog(); show('terrainDlg'); sfx('click'); }
export function closeTerrainDlg(){ hide('terrainDlg'); show('start'); buildTerrainPicker(); sfx('click'); }
tapBtn('terrainBtn', ()=>openBattleSetup('custom'));   // Z107 the battlefield button opens the CUSTOM battle setup tapBtn('terrainDone', closeTerrainDlg);
