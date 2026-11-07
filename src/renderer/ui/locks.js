// Toy locks on every element, tab and appearance value. Each lock has its own
// credential set (PIN, password, TOTP in any of the six mixes) in the OS
// vault, exponential back-off after wrong attempts, the unlock ladder to clear
// the waiting (never the credential), and the Support Tickets desk.
import { h, icon, clear } from '../core/dom.js';
import { pair, t, schoolOn } from '../core/i18n.js';
import * as store from '../core/store.js';
import { dialog, toast, floatPanel } from './overlay.js';
import { superConfirm } from './safety.js';
import { segmented, text, secret } from './controls.js';
import { sound } from '../core/feedback.js';
import QRCode from 'qrcode';
import totpLib from '../../shared/totp.js';

export const MIXES = [
  ['pin', 'PIN'], ['password', pair('Password', '密碼')], ['pin+password', pair('PIN + password', 'PIN + 密碼')],
  ['password+totp', pair('Password + authenticator', '密碼 + 驗證器')], ['pin+totp', pair('PIN + authenticator', 'PIN + 驗證器')], ['password+pin+totp', pair('Password + PIN + authenticator', '密碼 + PIN + 驗證器')]
];

export function lockWizard(id, anchor) {
  if (store.get('locks')[id]) { toast(pair('Already locked.', '已經鎖咗。'), { kind: 'info' }); return; }
  let mix = 'pin';
  const pin = secret('', { label: 'PIN', allowFile: false }), pass = secret('', { label: 'Password', allowFile: false });
  const totpSecret = totpLib.randomSecret();
  const totpCode = text('', { label: pair('Code from your authenticator', '驗證器上面嘅碼'), mono: true });
  const qr = h('img', { alt: pair('QR code for the authenticator. The secret is also shown as text.', '驗證器 QR 碼，下面有文字版密鑰。'), style: { width: '200px', height: '200px', background: '#fff', padding: '10px', borderRadius: '12px' } });
  const uri = totpLib.buildUri({ issuer: 'Material Tailscale', account: `lock ${id}`, secret: totpSecret });
  QRCode.toDataURL(uri, { margin: 2, width: 400, color: { dark: '#000000', light: '#ffffff' } }).then((u) => { qr.src = u; });
  const secretText = h('code.chip.mono', { hidden: true }, totpSecret.match(/.{1,4}/g).join(' '));
  const reveal = h('button.btn.small.outline', { type: 'button', on: { click: () => { secretText.hidden = !secretText.hidden; } } }, icon('visibility'), pair('Show the secret as text', '顯示文字密鑰'));
  const totpPane = h('div.stack', h('p.small', pair('Scan with any authenticator app (SHA-1, 6 digits, 30 seconds), then type the current code.', '用驗證器 App 掃描（SHA-1、6 位、30 秒），再輸入而家個碼。')), h('div.row', qr, h('div.stack', reveal, secretText, h('a', { href: '#', on: { click: (e) => { e.preventDefault(); /* in-app authenticator can add it too */ window.dispatchEvent(new CustomEvent('mt:add-totp', { detail: uri })); toast(pair('Added to the built-in authenticator.', '已加入內置驗證器。'), { kind: 'ok' }); } } }, pair('Add to this app\'s authenticator', '加入本程式驗證器')))), totpCode.el);
  const panes = h('div.stack');
  const draw = () => { clear(panes); if (mix.includes('pin')) panes.append(h('b', 'PIN'), pin.el); if (mix.includes('password')) panes.append(h('b', pair('Password', '密碼')), pass.el); if (mix.includes('totp')) panes.append(totpPane); };
  const seg = segmented(MIXES.map(([v, l]) => ({ value: v, label: l })), mix, { label: pair('Credential mix', '憑證組合') });
  seg.onChange((v) => { mix = v; draw(); });
  draw();
  const panel = floatPanel('lock-wizard', pair(`Lock: ${id}`, `鎖住：${id}`), h('div.stack', h('p.small.muted', pair('Pick exactly one mix. This lock gets its own credentials; nothing is shared with other locks.', '揀一個組合。每個鎖有自己嘅憑證，唔同其他鎖共用。')), seg.el, panes,
    h('div.row', h('button.btn', { type: 'button', on: { click: async () => {
      const rec = {};
      if (mix.includes('pin')) { if (!/^\d{4,12}$/.test(pin.get() || '')) { toast(pair('The PIN must be 4 to 12 digits.', 'PIN 要 4 至 12 位數字。'), { kind: 'warn' }); return; } rec.pin = pin.get(); }
      if (mix.includes('password')) { if ((pass.get() || '').length < 6) { toast(pair('Use at least 6 characters for the password.', '密碼最少 6 個字元。'), { kind: 'warn' }); return; } rec.password = pass.get(); }
      if (mix.includes('totp')) { if (!(await totpLib.verifyAsync(totpSecret, totpCode.get() || ''))) { toast(pair('That authenticator code does not match. Check the time on your phone and try again.', '驗證碼唔啱，檢查手機時間再試。'), { kind: 'warn' }); return; } rec.totpSecret = totpSecret; }
      try { await window.mt.secret.set('lock:' + id, rec); } catch (e) { toast(e.message, { kind: 'err' }); return; }
      store.set('locks', { ...store.get('locks'), [id]: { mix, attempts: 0, until: 0, at: Date.now() } }, { label: `lock ${id}` });
      sound('success'); toast(pair('Locked.', '已鎖。'), { kind: 'ok' }); panel.close(); applyLocks();
    } } }, icon('lock'), pair('Lock it', '鎖住')))), { anchor, width: 480, height: 640 });
}

export function applyLocks(root = document) {
  const locks = store.get('locks');
  root.querySelectorAll('[data-el]').forEach((el) => {
    const id = el.dataset.el;
    const locked = !!locks[id];
    if (locked && el.dataset.locked !== 'true') {
      el.dataset.locked = 'true';
      el.append(h('div.lock-veil', h('button.btn.tonal', { type: 'button', on: { click: (e) => { e.stopPropagation(); unlockPrompt(id, e.currentTarget); } } }, icon('lock'), pair('Locked · Unlock', '已鎖 · 解鎖'))));
    } else if (!locked && el.dataset.locked === 'true') {
      delete el.dataset.locked; el.querySelector(':scope > .lock-veil')?.remove();
    }
  });
}

export function unlockPrompt(id, anchor) {
  const L = store.get('locks')[id];
  if (!L) return;
  const pin = secret('', { label: 'PIN', allowFile: false }), pass = secret('', { label: 'Password', allowFile: false }), code = text('', { label: 'Code', mono: true });
  const wait = h('div.small', { 'aria-live': 'polite' });
  let waitUntil = 0;
  const refresh = async () => { const st = await window.mt.lockStatus('lock:' + id).catch(() => null); if (st) waitUntil = Date.now() + st.waitMs; };
  refresh();
  const timer = setInterval(() => { const left = waitUntil - Date.now(); wait.textContent = left > 0 ? pair(`Too many tries. Wait ${Math.ceil(left / 1000)} s or climb the ladder.`, `試太多次。等 ${Math.ceil(left / 1000)} 秒或者玩階梯。`) : ''; }, 300);
  const d = dialog({ title: pair('Unlock', '解鎖'), emojiChar: '🔐', onClose: () => clearInterval(timer), body: h('div.stack',
    L.mix.includes('pin') ? h('div.stack', h('b', 'PIN'), pin.el) : null, L.mix.includes('password') ? h('div.stack', h('b', pair('Password', '密碼')), pass.el) : null, L.mix.includes('totp') ? h('div.stack', h('b', pair('Authenticator code', '驗證碼')), code.el) : null, wait,
    h('div.row', h('button.btn.small.outline', { type: 'button', on: { click: () => { d.close(); ladder(id); } } }, icon('stairs'), pair('Unlock ladder', '解鎖階梯')), h('button.btn.small.text', { type: 'button', on: { click: () => { d.close(); supportTickets(); } } }, icon('support_agent'), pair('Support Tickets', '支援服務台')))),
    actions: [{ label: t('cancel'), kind: 'outline', value: false }, { label: pair('Unlock', '解鎖'), run: async () => {
      const r = await window.mt.lockVerify('lock:' + id, { pin: pin.get(), password: pass.get(), totp: code.get() });
      if (r.ok) { const all = { ...store.get('locks') }; delete all[id]; store.set('locks', all, { label: `unlock ${id}` }); await window.mt.secret.clear('lock:' + id); sound('success'); toast(pair('Unlocked and lock removed.', '已解鎖並移除鎖。'), { kind: 'ok' }); applyLocks(); return true; }
      waitUntil = Date.now() + (r.waitMs || 0);
      sound('denied');
      toast(r.waitMs && !r.attempts ? pair('Still waiting. Try the ladder or wait.', '仲要等。玩階梯或者等吓。') : pair(`That did not match (attempt ${r.attempts}).`, `唔啱（第 ${r.attempts} 次）。`), { kind: 'err' });
      return false;
    } }] });
}

/** The unlock ladder. Every rung is graded in the main process against a single-use nonce. */
export function ladder(id) {
  const box = h('div.stack');
  const school = schoolOn();
  let dimsumSkipped = school;
  const rungs = school ? ['sums', 'mole', 'clock'] : ['dimsum', 'sums', 'mole', 'clock'];
  let i = 0;
  const next = () => { i++; show(); };
  const finish = async () => {
    const r = await window.mt.ladder.complete('lock:' + id, { school, dimsumSkipped });
    if (r.ok) { sound('levelup'); toast(pair('Waiting cleared. Your credential is still required and attempts are not refunded.', '已清除等待時間。仍然要憑證，次數唔會退返。'), { kind: 'ok' }); d.close(); }
    else toast(r.capped ? pair('The ladder can be climbed 3 times an hour.', '每小時只可以玩 3 次。') : pair('Not every rung was passed.', '未過晒每一關。'), { kind: 'warn' });
  };
  const show = async () => {
    clear(box);
    const rung = rungs[i];
    if (rung === 'clock') {
      const st = await window.mt.lockStatus('lock:' + id);
      if (st.waitMs <= 0 || i > 0) { await finish(); return; }
    }
    if (rung === 'dimsum') {
      box.append(h('div.skeleton', { style: { height: '200px' } }));
      const c = await window.mt.ladder.start('lock:' + id, 'dimsum', { school });
      clear(box);
      if (c.capped) { box.append(h('p', pair('The ladder can be climbed 3 times an hour. Only the clock remains.', '每小時只可以玩 3 次，而家只可以等。'))); return; }
      if (!c.ok) { dimsumSkipped = true; box.append(h('p', pair('The dim sum rung is unavailable right now; on to the sums.', '點心關暫時用唔到，去數學題。')), h('button.btn', { on: { click: next } }, t('next'))); return; }
      box.append(h('h3', pair('Which dish is this?', '呢個係咩點心？')), h('img', { src: c.photo, alt: c.alt, style: { width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '16px' } }),
        h('div.grid', c.choices.map((p) => h('button.btn.outline.span-6', { on: { click: async () => { const r = await window.mt.ladder.answer(c.nonce, p.id); if (r.ok) { sound('success'); next(); } else { sound('denied'); toast(pair('Not that one. The rung restarts with a new dish.', '唔啱，換過一款再嚟。'), { kind: 'warn' }); show(); } } } }, `${p.en} · ${p.zh}`))));
    } else if (rung === 'sums') {
      const c = await window.mt.ladder.start('lock:' + id, 'sums', { school });
      if (c.capped) { box.append(h('p', pair('The ladder can be climbed 3 times an hour.', '每小時只可以玩 3 次。'))); return; }
      const answers = []; let k = 0;
      const q = h('h3'), inp = h('input.input', { inputmode: 'numeric', 'aria-label': pair('Answer', '答案') });
      const ask = () => { const [a, b] = c.questions[k]; q.textContent = pair(`Sum ${k + 1} of 10: ${a} + ${b} = ?`, `第 ${k + 1}/10 題：${a} + ${b} = ?`); inp.value = ''; inp.focus(); };
      inp.addEventListener('keydown', async (e) => { if (e.key !== 'Enter' || inp.value === '') return; answers.push(Number(inp.value)); k++; sound('click'); if (k < 10) ask(); else { const r = await window.mt.ladder.answer(c.nonce, answers); if (r.ok) next(); else { toast(pair('Some sums were wrong. New sums coming up.', '有啲答錯，換過新題目。'), { kind: 'warn' }); show(); } } });
      box.append(q, inp); ask();
    } else if (rung === 'mole') {
      const c = await window.mt.ladder.start('lock:' + id, 'mole', { school });
      let hits = 0, left = c.seconds;
      const t0 = Date.now();
      const holes = [...Array(9)].map((_, n) => h('button.mole', { 'aria-label': pair(`Hole ${n + 1}`, `第 ${n + 1} 個洞`), on: { click: async () => { const r = await window.mt.ladder.answer(c.nonce, { hole: n }); hits = r.hits ?? hits; if (r.ok) sound('click'); draw(); } } }));
      const info = h('div');
      const draw = () => { const tick = Math.floor((Date.now() - t0) / c.tickMs); holes.forEach((m, n) => { const up = c.seq[tick] === n && left > 0; m.classList.toggle('up', up); m.textContent = up ? '🥟' : ''; }); info.textContent = pair(`Hits ${hits} of 10 · ${left}s left`, `打中 ${hits}/10 · 剩 ${left} 秒`); };
      const iv = setInterval(draw, 120);
      const tv = setInterval(async () => { left--; if (left <= 0) { clearInterval(iv); clearInterval(tv); const r = await window.mt.ladder.answer(c.nonce, { finish: true }); if (r.ok) next(); else { toast(pair(`Only ${r.hits ?? hits} hits. On to the clock.`, `只打中 ${r.hits ?? hits} 個，要等時間。`), { kind: 'warn' }); i = rungs.indexOf('clock'); showClock(); } } }, 1000);
      box.append(h('h3', pair('Whack 10 dumplings before the clock ends. Rounds cannot be won early.', '時間完之前打中 10 個點心，唔可以提早贏。')), h('div.mole-grid', holes), info); draw();
    } else showClock();
  };
  const showClock = async () => {
    clear(box);
    const tick = h('h2.mono');
    const iv = setInterval(async () => { const st = await window.mt.lockStatus('lock:' + id).catch(() => ({ waitMs: 0 })); tick.textContent = st.waitMs > 0 ? `${Math.ceil(st.waitMs / 1000)} s` : pair('You can try again now.', '可以再試啦。'); if (st.waitMs <= 0) clearInterval(iv); }, 500);
    box.append(h('p', pair('The clock: wait out the remaining time.', '時鐘：等完剩低嘅時間。')), tick);
  };
  const d = dialog({ title: pair('Unlock ladder', '解鎖階梯'), emojiChar: '🪜', body: h('div.stack', h('p.small.muted', pair('Clears the waiting only. Your PIN, password or code is still needed.', '只會清除等待，PIN、密碼或驗證碼仍然要。')), box) });
  show();
}

export async function supportTickets() {
  const info = await window.mt.info();
  const p = info.userData;
  const n = Math.floor(1000 + Math.random() * 9000);
  dialog({ title: pair('Support Tickets', '支援服務台'), emojiChar: '🎫', body: h('div.stack',
    h('p', pair(`Ticket #${n} opened. Our support team of one very small dumpling has reviewed your case at lightning speed and recommends the classic remedy: open the app data folder and remove the lock you no longer want.`, `已開 #${n} 號單。我哋得一粒細細嘅餃子做客服，佢極速睇完，建議經典做法：打開程式資料夾，刪除唔要嘅鎖。`)),
    h('div.cmdline', p), h('p', { style: { fontFamily: 'var(--font-body)', fontStyle: 'normal' } }, 'Nothing is sent anywhere and nobody is reading this. 冇任何資料會傳出去，亦冇人睇緊。'),
    h('div.row', h('button.btn', { on: { click: () => window.mt.shell.openPath(p) } }, icon('folder_open'), pair('Open the folder', '打開資料夾')), h('button.btn.outline', { on: { click: () => { navigator.clipboard.writeText(p); toast(t('copied'), { kind: 'ok' }); } } }, icon('content_copy'), pair('Copy path', '複製路徑')),
      h('button.btn.danger', { on: { click: async () => { if (await superConfirm({ action: pair('Remove every lock in this app', '移除本程式所有鎖'), affects: pair('Lock records and their saved credentials. Nothing else.', '鎖紀錄同佢哋嘅憑證，其他唔變。') })) { for (const id of Object.keys(store.get('locks'))) { await window.mt.secret.clear('lock:' + id).catch(() => {}); await window.mt.lockClearState('lock:' + id).catch(() => {}); } store.set('locks', {}); applyLocks(); toast(pair('All locks removed.', '已移除所有鎖。'), { kind: 'ok' }); } } } }, icon('lock_reset'), pair('Remove all locks…', '移除所有鎖…')))) });
}
