'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);
contextBridge.exposeInMainWorld('build', {
  info: call('build:info'), pickFolder: call('build:pickFolder'), useBundled: call('build:useBundled'), start: call('build:start'), stop: call('build:stop'), copy: call('build:copy'),
  onLine: (fn) => { const h = (_e, m) => fn(m); ipcRenderer.on('build:line', h); return () => ipcRenderer.removeListener('build:line', h); },
  onDone: (fn) => { const h = (_e, m) => fn(m); ipcRenderer.on('build:done', h); return () => ipcRenderer.removeListener('build:done', h); }
});
