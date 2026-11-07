// Manual update checks for the About page and Settings. The installed Windows app checks
// its unsigned release feed in the background; this asks it to check now and reports the
// outcome in the current language instead of a raw status string.
import { pair } from '../core/i18n.js';
import { toast } from './overlay.js';
import { copyHelpRequest } from './jobs.js';

let waiting = false;
const failed = (message) => toast(pair(`Could not check for updates: ${message}`, `檢查唔到更新：${message}`), {
  kind: 'err', actions: [{ label: pair('Copy a help request', '複製求助訊息'), run: () => copyHelpRequest('Checking for updates', message) }]
});

window.mt?.update?.onState?.((s) => {
  if (!waiting) return;
  if (s.state === 'current') { waiting = false; toast(pair('You have the latest version.', '你已經用緊最新版本。'), { kind: 'ok' }); }
  else if (s.state === 'downloading') { waiting = false; toast(pair('A new version is downloading. You will be asked before it restarts.', '新版本下載緊，重新啟動之前會問你。')); }
  else if (s.state === 'error') { waiting = false; failed(s.message || 'unknown error'); }
});

/** Asks the installed app to check its release feed now and reports what happened. */
export async function checkForUpdates() {
  const r = await window.mt.update.check().catch((e) => ({ state: 'error', message: e.message }));
  if (r?.state === 'unsupported') {
    toast(pair('This copy was not installed by the Windows installer, so it does not update itself. Download the latest version from the website.', '呢份唔係用 Windows 安裝程式裝嘅，所以唔會自己更新。請去網站下載最新版本。'), { emojiChar: '📦' });
  } else if (r?.state === 'error') failed(r.message);
  else { waiting = true; toast(pair('Checking for updates…', '檢查緊更新…')); }
  return r;
}
