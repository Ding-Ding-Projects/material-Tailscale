'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const call = (ch) => async (...a) => {
  const r = await ipcRenderer.invoke(ch, ...a);
  if (!r.ok) { const e = new Error(r.error); e.code = r.code; throw e; }
  return r.value;
};
const on = (ch) => (fn) => {
  const h = (_e, msg) => fn(msg);
  ipcRenderer.on(ch, h);
  return () => ipcRenderer.removeListener(ch, h);
};

contextBridge.exposeInMainWorld('mt', {
  info: call('app:info'),
  cliCatalog: call('cli:catalog'),
  apiCatalog: call('api:catalog'),
  ts: { locate: call('ts:locate'), setBinary: call('ts:setBinary'), run: call('ts:run'), raw: call('ts:raw'), stream: call('ts:stream'), cancel: call('ts:cancel'), terminal: call('ts:terminal'), onStream: on('ts:stream') },
  api: call('api:request'),
  secret: { set: call('secret:set'), presence: call('secret:presence'), clear: call('secret:clear'), available: call('secret:available') },
  lockVerify: call('lock:verify'),
  lockStatus: call('lock:status'),
  lockClearState: call('lock:clearState'),
  ladder: { start: call('ladder:start'), answer: call('ladder:answer'), complete: call('ladder:complete') },
  tools: { installTailscale: call('tools:installTailscale'), installOllama: call('tools:installOllama'), ensureJava: call('tools:ensureJava'), archiveCreate: call('tools:archiveCreate'), archiveExtract: call('tools:archiveExtract'), archiveList: call('tools:archiveList'), archiveData: call('tools:archiveData'), convertMedia: call('tools:convertMedia'), convertDocument: call('tools:convertDocument'), grep: call('tools:grep'), bundled: call('tools:bundled'), onProgress: on('tools:progress') },
  authLoad: call('auth:load'),
  mc: Object.assign(Object.fromEntries(['registry', 'catalog', 'resolve', 'probe', 'discover', 'create', 'adopt', 'acceptEula', 'start', 'stop', 'command', 'status', 'readFile', 'writeFile', 'update', 'searchExtensions', 'installExtension', 'listExtensions', 'toggleExtension', 'removeExtension', 'backup', 'listBackups', 'restore', 'extractWorldgen', 'generateWorld', 'cancelGenerate', 'lookupPlayer', 'remove', 'followLogs'].map((n) => [n, call('mc:' + n)])), { onLog: on('mc:log'), onState: on('mc:state') }),
  ext: Object.fromEntries(['list', 'allow', 'setEnabled', 'setMasterOff', 'remove', 'openFolder', 'run', 'add'].map((k) => [k, call('ext:' + k)])),
  history: { record: call('history:record'), list: call('history:list'), files: call('history:files'), restore: call('history:restore') },
  shared: { get: call('shared:get'), set: call('shared:set'), onChange: on('shared:changed') },
  dialog: { open: call('dialog:open'), save: call('dialog:save') },
  fs: { writeText: call('fs:writeText'), writeBytes: call('fs:writeBytes'), readText: call('fs:readText'), readBytes: call('fs:readBytes') },
  shell: { external: call('shell:external'), openPath: call('shell:openPath'), showItem: call('shell:showItem') },
  editor: { detect: call('editor:detect'), open: call('editor:open') },
  clipboardImage: call('clipboard:readImage'),
  notify: call('notify'),
  update: { install: call('update:install'), check: call('update:check'), onState: on('update:state') },
  win: { minimize: call('win:minimize'), maximize: call('win:maximize'), close: call('win:close'), title: call('win:title'), capture: call('win:capture'), overlay: call('win:overlay'), onState: on('win:state') },
  onTray: on('tray:result'),
  pathForFile: (file) => webUtils.getPathForFile(file)
});
