// desktop/preload.cjs — tells the game it runs as the native Mac app (it then raises shadow / render quality for Apple Silicon)
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('__NATIVE', { platform: process.platform, arch: process.arch, app: 'electron' });
