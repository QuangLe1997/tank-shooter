// Regenerate the module catalogue in ARCHITECTURE.md §2.1 (between the MODULES markers) from hub.js order (Z103):
//   npm run modmap
import fs from 'fs'; import path from 'path'; import { ROOT, SRC, hubOrder } from './lib.mjs';
const LAYER = { data:'DỮ LIỆU THUẦN (registry) — không logic, test được bằng node', core:'Hằng số runtime, trạng thái, hồ sơ, tiện ích', render:'Three.js renderer + hậu kỳ',
  audio:'Âm thanh tổng hợp', world:'Bản đồ: địa hình, khí quyển, vật cản, công trình', tank:'Mô hình xe tăng, nòng, khiên, rig', fx:'Hiệu ứng hình ảnh',
  combat:'Vũ khí, đạn, kỹ năng', actors:'Đơn vị trên sân (địch, lính, drone, Lõi)', ai:'Trí tuệ địch', campaign:'Chiến dịch, đợt, tướng, pháo kích',
  loot:'Vật phẩm, rơi đồ, nâng cấp roguelite', input:'Bàn phím, chuột, cảm ứng', ui:'Giao diện DOM (menu, shop, HUD phụ, gợi ý)', game:'Luồng game, vòng lặp, khởi động',
  dev:'Móc kiểm thử / gỡ lỗi (không ảnh hưởng gameplay)' };
const desc = code => { for(const l of code.split('\n')){ if(!l.startsWith('//')) { if(/^import /.test(l)||!l.trim()) continue; break; }
    if(/^\/\/ Z98 HUB/.test(l)) continue;
    let d=l.replace(/^\/\/\s*/,'').replace(/^[\w/.-]+\.js\s+—\s*/,'').replace(/^[-=\s·]+|[-=\s]+$/g,'').replace(/\|/g,'/'); if(d) return d.length>110?d.slice(0,108)+'…':d; }
  const m=code.match(/^\/\/ *-{3,}\s*(.+?)\s*-{3,}/m)||code.match(/^\/\/ *(?:=+|-+)\s*(.+)$/m)||code.match(/^\s*\/\/ *(?!AUTO-SPLIT)([^\n]{12,})$/m);
  return m?m[1].replace(/[-=]+$/,'').trim().replace(/\|/g,'/').slice(0,110):''; };
// grouped by layer (in LAYER order); "#" = position in hub.js = evaluation order
const rows=['| # | Module | Dòng | Nội dung |','|---:|---|---:|---|'], order=hubOrder(); let n=0, total=0;
for(const layer of Object.keys(LAYER)){ const mods=order.map((r,i)=>[r,i+1]).filter(([r])=>r.split('/')[0]===layer); if(!mods.length) continue;
  rows.push(`| | **${layer}/** — ${LAYER[layer]} | | |`);
  for(const [r,i] of mods){ const code=fs.readFileSync(path.join(SRC,r),'utf8'), lines=code.split('\n').length; rows.push(`| ${i} | \`src/${r}\` | ${lines} | ${desc(code)} |`); n++; total+=lines; } }
if(n!==order.length){ console.log('✗ a hub module sits in a layer missing from LAYER'); process.exit(1); }
const doc=path.join(ROOT,'ARCHITECTURE.md'); let md=fs.readFileSync(doc,'utf8');
const B='<!-- MODULES:BEGIN (npm run modmap) -->', E='<!-- MODULES:END -->';
if(!md.includes(B)){ console.log('✗ markers not found in ARCHITECTURE.md'); process.exit(1); }
md=md.replace(new RegExp(B.replace(/[()]/g,'\\$&')+'[\\s\\S]*?'+E), B+'\n'+rows.join('\n')+'\n'+E)
     .replace(/### 2\.1 Danh mục module \([^)]*\)/, `### 2.1 Danh mục module (${n} module theo thứ tự hub · ${total.toLocaleString('vi-VN')} dòng)`);
fs.writeFileSync(doc, md); console.log(`modmap: ${n} modules · ${total} lines`);
