// desktop/main.cjs — Steel Siege for macOS: an Electron window that serves the game from app://game (ES modules work, no file:// CORS),
// fully offline (three.js + fonts vendored by build.mjs), on the high-performance GPU through Metal, never throttled in the background.
const { app, BrowserWindow, Menu, protocol, net, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const GAME_DIR = path.join(__dirname, 'app');            // filled by build.mjs (copy of the web game, rewritten for offline)

// GPU: Metal-backed ANGLE, discrete/high-performance adapter, GPU raster + zero-copy uploads, no blocklist surprises
app.commandLine.appendSwitch('use-angle', 'metal');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }]);

function serve(){
  protocol.handle('app', (req) => {
    const u = new URL(req.url); let rel = decodeURIComponent(u.pathname);
    if(!rel || rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(GAME_DIR, rel));
    if(!file.startsWith(GAME_DIR)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

let win = null;
function createWindow(){
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540, show: false,
    title: 'Steel Siege', backgroundColor: '#07090a', fullscreenable: true, titleBarStyle: 'hiddenInset',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false, spellcheck: false, autoplayPolicy: 'no-user-gesture-required' },
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if(/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });   // external links → the real browser
  win.webContents.on('will-navigate', (e, url) => { if(!url.startsWith('app://')) e.preventDefault(); });
  win.loadURL('app://game/index.html');
}

function menu(){
  const tpl = [
    { label: 'Steel Siege', submenu: [ { role: 'about', label: 'Giới thiệu Steel Siege' }, { type: 'separator' }, { role: 'hide', label: 'Ẩn' }, { role: 'hideOthers', label: 'Ẩn ứng dụng khác' }, { type: 'separator' }, { role: 'quit', label: 'Thoát Steel Siege' } ] },
    { label: 'Hiển thị', submenu: [ { role: 'togglefullscreen', label: 'Toàn màn hình' }, { role: 'reload', label: 'Tải lại' }, { role: 'toggleDevTools', label: 'Công cụ nhà phát triển' } ] },
    { label: 'Cửa sổ', submenu: [ { role: 'minimize', label: 'Thu nhỏ' }, { role: 'zoom', label: 'Phóng to' } ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

app.setAboutPanelOptions({ applicationName: 'Steel Siege', applicationVersion: app.getVersion(), copyright: 'Đại đội Thép 7' });
app.whenReady().then(() => { serve(); menu(); createWindow(); app.on('activate', () => { if(BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => app.quit());
