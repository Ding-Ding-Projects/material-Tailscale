import { h, icon, clear, fmtAgo } from '../core/dom.js';
import { t, pair } from '../core/i18n.js';
import { registerPage, openDest } from '../ui/shell.js';
import { toast, dialog, collapsible, menu } from '../ui/overlay.js';
import { superConfirm } from '../ui/safety.js';
import { jsonTree } from '../ui/jsontree.js';
import { exportMenu } from '../ui/exporter.js';
import { schemaControl } from '../ui/schema-form.js';
import { segmented, text, secret, chips, switchCtl, stepper, duration } from '../ui/controls.js';
import { infoBtn } from '../ui/command-form.js';
import { regexField } from '../ui/regex.js';
import { sound } from '../core/feedback.js';

let catalog = null;
const getCatalog = async () => (catalog ||= await window.mt.apiCatalog());
const opById = (id) => catalog.operations.find((o) => o.id === id);
const clean = (d) => String(d || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
const TAG_YUE = { Devices: '裝置', DeviceInvites: '裝置邀請', UserInvites: '用戶邀請', Logging: '日誌', DNS: 'DNS', Keys: '鎖匙', PolicyFile: '政策檔', DevicePosture: '裝置狀態', Users: '用戶', Contacts: '聯絡人', Webhooks: 'Webhook', TailnetSettings: 'Tailnet 設定', Services: '服務', OAuthApps: 'OAuth 應用', Organizations: '組織' };

export async function api(method, path, { query, body, accept } = {}) {
  const r = await window.mt.api({ method, path, query, body, accept });
  if (!r.ok) {
    const msg = r.json?.message || r.text?.slice(0, 300) || `HTTP ${r.status}`;
    throw Object.assign(new Error(`${method} ${path}: ${msg}`), { status: r.status, response: r });
  }
  return r;
}

async function runOp(op, { pathParams = {}, query, body, confirm = true } = {}) {
  let p = op.path;
  for (const [k, v] of Object.entries(pathParams)) p = p.replace(`{${k}}`, encodeURIComponent(v));
  if (/\{(?!tailnet\})[^}]+\}/.test(p)) throw new Error(pair('Fill in every path parameter first.', '請先填晒路徑參數。'));
  if (op.destructive && confirm && !(await superConfirm({ action: `${op.method} ${p}`, affects: op.summary }))) return null;
  const r = await api(op.method, p, { query, body });
  window.mt.history.record(`Admin API ${op.method} ${op.path}`, { 'last-admin-call.json': { at: new Date().toISOString(), op: op.id, path: p, status: r.status } }).catch(() => {});
  return r;
}

// ---------------- connection ----------------
function connectionCard(onDone) {
  const box = h('div.stack');
  const draw = async () => {
    clear(box);
    const pres = await window.mt.secret.presence('admin');
    if (pres.present) {
      box.append(h('div.row', h('span.badge.ok', pair('Connected', '已連接')), h('span', `${pres.kind === 'oauth' ? 'OAuth client' : 'API access token'} ${pres.hint || ''} · tailnet ${pres.tailnet || '-'}`), h('span.spacer'),
        h('button.btn.small.outline', { on: { click: async () => { if (await superConfirm({ action: pair('Remove the saved admin credential', '刪除已儲存嘅管理憑證'), affects: pair('Only the encrypted copy on this computer. The token itself stays valid until you revoke it in Tailscale.', '只係本機加密副本，權杖本身要喺 Tailscale 撤銷先失效。') })) { await window.mt.secret.clear('admin'); draw(); onDone?.(); } } } }, icon('link_off'), pair('Disconnect', '斷開'))));
      return;
    }
    const kind = segmented([{ value: 'apiKey', label: pair('API access token', 'API 權杖'), icon: 'key' }, { value: 'oauth', label: pair('OAuth client', 'OAuth 用戶端'), icon: 'badge' }], 'apiKey', { label: 'Credential type' });
    const tok = secret('', { label: 'Token', allowFile: false });
    const cid = text('', { label: 'Client ID', mono: true });
    const scopes = chips([], { kind: 'any', label: 'Scopes', suggestions: ['all', 'all:read', 'devices:core', 'devices:routes', 'auth_keys', 'policy_file', 'dns', 'users', 'logs:configuration:read', 'logs:network:read', 'webhooks', 'feature_settings'] });
    const tn = text('-', { label: 'Tailnet', mono: true });
    const oauthPane = h('div.stack', { hidden: true }, h('b', 'Client ID'), cid.el, h('b', pair('Scopes', '權限範圍')), scopes.el);
    kind.onChange((k) => { oauthPane.hidden = k !== 'oauth'; });
    box.append(h('p.muted', t('apiNoCred')), kind.el, h('b', pair('Secret', '密鑰')), tok.el, oauthPane, h('div.row', infoBtn('Tailnet', pair('Use - for the tailnet the credential belongs to, or the organisation name shown in the admin console.', '用 - 代表憑證所屬嘅 tailnet，或者填管理控制台顯示嘅組織名。')), h('b', 'Tailnet')), tn.el,
      h('div.row', h('button.btn', { on: { click: async () => {
        const v = tok.get();
        if (!v) { toast(pair('Paste the token or secret first.', '先貼權杖或密鑰。'), { kind: 'warn' }); return; }
        try {
          await window.mt.secret.set('admin', { kind: kind.get(), value: v, clientId: cid.get(), scopes: (scopes.get() || []).join(' '), tailnet: tn.get() || '-' });
          await api('GET', '/tailnet/{tailnet}/devices');
          toast(pair('Connected to the Tailscale admin API.', '已連接 Tailscale 管理 API。'), { kind: 'ok' }); sound('connect'); draw(); onDone?.();
        } catch (e) { toast(e.message, { kind: 'err', title: pair('Could not connect', '連接唔到') }); }
      } } }, icon('link'), pair('Save and test', '儲存並測試')), h('button.btn.text', { on: { click: () => window.mt.shell.external('https://login.tailscale.com/admin/settings/keys') } }, icon('open_in_new'), pair('Create a token', '建立權杖'))),
      h('p.small.muted', pair('The credential is encrypted with your operating system\'s keychain and never leaves the main process.', '憑證用作業系統鎖匙圈加密，唔會離開主程序。')));
  };
  draw();
  return h('section.card', h('div.card-head', h('h2', pair('Connection', '連接')), infoBtn(pair('Admin API connection', '管理 API 連接'), pair('An API access token (tskey-api-…) or an OAuth client (tskey-client-…) with the scopes you need.', 'API 權杖（tskey-api-…）或者有所需權限嘅 OAuth 用戶端。'))), box);
}

// ---------------- devices ----------------
function devicesView() {
  const wrap = h('div.stack');
  const sel = new Set();
  let devices = [];
  const search = regexField({ id: 'admin-devices', placeholder: pair('Filter devices', '篩選裝置'), onChange: () => draw() });
  const load = async () => {
    clear(wrap).append(h('div.skeleton', { style: { height: '200px' } }));
    try { devices = (await api('GET', '/tailnet/{tailnet}/devices', { query: { fields: 'all' } })).json.devices || []; draw(); }
    catch (e) { clear(wrap).append(h('div.err-text', e.message)); }
  };
  const act = async (label, list, fn, { destructive } = {}) => {
    if (destructive && !(await superConfirm({ action: `${label}: ${list.length}`, affects: list.map((d) => d.name).join(', ') }))) return;
    let ok = 0; const fails = [];
    for (const d of list) { try { await fn(d); ok++; } catch (e) { fails.push(`${d.name}: ${e.message}`); } }
    toast(pair(`${label}: ${ok} done${fails.length ? `, ${fails.length} skipped` : ''}.`, `${label}：完成 ${ok}${fails.length ? `，跳過 ${fails.length}` : ''}。`), { kind: fails.length ? 'warn' : 'ok' });
    if (fails.length) dialog({ title: pair('Skipped devices', '跳過嘅裝置'), body: h('div.out', fails.join('\n')) });
    load();
  };
  const tagDialog = (list) => {
    const c = chips(list.length === 1 ? list[0].tags || [] : [], { kind: 'tags', label: 'Tags', suggestions: ['tag:server', 'tag:prod', 'tag:dev'] });
    dialog({ title: pair('Set tags', '設定標籤'), body: h('div.stack', h('p.small.muted', pair(`Applies to ${list.length} device(s). Replaces existing tags.`, `套用到 ${list.length} 部，會取代現有標籤。`)), c.el), actions: [{ label: t('cancel'), kind: 'outline', value: false }, { label: t('apply'), run: () => act('Tags', list, (d) => api('POST', `/device/${d.id}/tags`, { body: { tags: c.get() } })) }] });
  };
  const routesDialog = async (d) => {
    const r = (await api('GET', `/device/${d.id}/routes`)).json;
    const c = chips(r.enabledRoutes || [], { kind: 'cidrs', label: 'Enabled routes', suggestions: r.advertisedRoutes || [] });
    dialog({ title: pair(`Routes for ${d.name}`, `${d.name} 嘅路由`), body: h('div.stack', h('div', h('b', pair('Advertised', '已宣告')), h('div.row', (r.advertisedRoutes || []).map((x) => h('span.chip.mono', x)))), h('b', pair('Approved', '已批准')), c.el), actions: [{ label: t('cancel'), kind: 'outline', value: false }, { label: pair('Approve all advertised', '全部批准'), kind: 'tonal', run: () => act('Routes', [d], () => api('POST', `/device/${d.id}/routes`, { body: { routes: r.advertisedRoutes || [] } })) }, { label: t('apply'), run: () => act('Routes', [d], () => api('POST', `/device/${d.id}/routes`, { body: { routes: c.get() } })) }] });
  };
  const draw = () => {
    clear(wrap);
    const { q, re } = search.value();
    const test = (s) => { if (!q) return true; if (re) { try { return new RegExp(q, 'i').test(s); } catch { return true; } } return s.toLowerCase().includes(q.toLowerCase()); };
    const ms = devices.filter((d) => test(`${d.name} ${d.hostname} ${(d.addresses || []).join(' ')} ${(d.tags || []).join(' ')} ${d.os} ${d.user}`));
    const chosen = () => ms.filter((d) => sel.has(d.id));
    const bar = h('div.row', h('span.badge.info', `${ms.length} / ${devices.length}`),
      h('button.btn.small.tonal', { on: { click: () => { ms.forEach((d) => sel.add(d.id)); draw(); } } }, pair('Select all matches', '全選')),
      h('button.btn.small.tonal', { on: { click: () => { ms.forEach((d) => (sel.has(d.id) ? sel.delete(d.id) : sel.add(d.id))); draw(); } } }, pair('Invert', '反選')),
      h('span.spacer'), sel.size ? h('b', pair(`${sel.size} selected`, `已揀 ${sel.size}`)) : null,
      h('button.btn.small', { disabled: !sel.size, on: { click: () => act(pair('Authorize', '授權'), chosen(), (d) => api('POST', `/device/${d.id}/authorized`, { body: { authorized: true } })) } }, icon('verified_user'), pair('Authorize', '授權')),
      h('button.btn.small.outline', { disabled: !sel.size, on: { click: () => tagDialog(chosen()) } }, icon('sell'), pair('Tags', '標籤')),
      h('button.btn.small.outline', { disabled: !sel.size, on: { click: () => act(pair('Disable key expiry', '停用鎖匙過期'), chosen(), (d) => api('POST', `/device/${d.id}/key`, { body: { keyExpiryDisabled: true } })) } }, icon('timer_off'), pair('No expiry', '唔過期')),
      h('button.btn.small.outline', { disabled: !sel.size, on: { click: () => act(pair('Expire key', '令鎖匙過期'), chosen(), (d) => api('POST', `/device/${d.id}/expire`), { destructive: true }) } }, icon('timer'), pair('Expire', '過期')),
      h('button.btn.small.danger', { disabled: !sel.size, on: { click: () => act(pair('Delete', '刪除'), chosen(), (d) => api('DELETE', `/device/${d.id}`), { destructive: true }) } }, icon('delete'), pair('Delete', '刪除')),
      exportMenu(() => ({ name: 'tailnet-devices', data: sel.size ? chosen() : ms })));
    const rows = ms.map((d) => {
      const tr = h('tr' + (sel.has(d.id) ? '.sel' : ''),
        h('td', h('input', { type: 'checkbox', checked: sel.has(d.id), 'aria-label': `Select ${d.name}`, on: { change: (e) => { e.target.checked ? sel.add(d.id) : sel.delete(d.id); draw(); } } })),
        h('td', h('b', d.name?.split('.')[0]), h('div.small.muted', d.user)), h('td.mono.small', (d.addresses || []).join('\n')), h('td', d.os), h('td', d.clientVersion?.split('-')[0]),
        h('td', d.authorized ? h('span.badge.ok', pair('authorized', '已授權')) : h('span.badge.warn', pair('needs approval', '待批准'))),
        h('td', (d.tags || []).map((x) => h('span.chip', { style: { margin: '2px' } }, x))),
        h('td', d.keyExpiryDisabled ? pair('never', '唔過期') : d.expires ? new Date(d.expires).toLocaleDateString() : ''),
        h('td', fmtAgo(d.lastSeen)),
        h('td', h('button.icon-btn.sm', { 'aria-label': pair('Device actions', '裝置動作'), on: { click: (e) => devMenu(e.currentTarget, d) } }, icon('more_vert'))));
      tr.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); devMenu({ x: e.clientX, y: e.clientY }, d); });
      return tr;
    });
    wrap.append(bar, h('div.tbl-wrap', h('table.tbl', h('thead', h('tr', h('th', ''), ['Name', 'Addresses', 'OS', 'Version', 'State', 'Tags', 'Key expiry', 'Last seen', ''].map((c) => h('th', c)))), h('tbody', rows))));
  };
  const devMenu = (at, d) => menu(at, [
    { label: pair('Rename…', '改名…'), icon: 'edit', run: () => { const n = text(d.name.split('.')[0], { label: 'Name', mono: true }); dialog({ title: pair('Rename device', '改裝置名'), body: n.el, actions: [{ label: t('cancel'), kind: 'outline', value: false }, { label: t('apply'), run: () => act('Rename', [d], () => api('POST', `/device/${d.id}/name`, { body: { name: n.get() } })) }] }); } },
    { label: pair('Routes…', '路由…'), icon: 'alt_route', run: () => routesDialog(d) },
    { label: pair('Tags…', '標籤…'), icon: 'sell', run: () => tagDialog([d]) },
    { label: pair('Set IPv4…', '設定 IPv4…'), icon: 'pin', run: () => { const n = text((d.addresses || [])[0] || '', { label: 'IPv4', mono: true }); dialog({ title: 'IPv4', body: n.el, actions: [{ label: t('cancel'), kind: 'outline', value: false }, { label: t('apply'), run: () => act('IPv4', [d], () => api('POST', `/device/${d.id}/ip`, { body: { ipv4: n.get() } })) }] }); } },
    { label: d.keyExpiryDisabled ? pair('Enable key expiry', '啟用鎖匙過期') : pair('Disable key expiry', '停用鎖匙過期'), icon: 'timer_off', run: () => act('Key expiry', [d], () => api('POST', `/device/${d.id}/key`, { body: { keyExpiryDisabled: !d.keyExpiryDisabled } })) },
    { label: d.authorized ? pair('Deauthorize', '取消授權') : pair('Authorize', '授權'), icon: 'verified_user', run: () => act('Authorize', [d], () => api('POST', `/device/${d.id}/authorized`, { body: { authorized: !d.authorized } })) },
    { label: pair('Posture attributes', '裝置狀態屬性'), icon: 'fact_check', run: async () => dialog({ title: d.name, wide: true, body: jsonTree((await api('GET', `/device/${d.id}/attributes`)).json, { open: 2 }) }) },
    { label: pair('Device invites', '裝置邀請'), icon: 'mail', run: async () => dialog({ title: d.name, wide: true, body: jsonTree((await api('GET', `/device/${d.id}/device-invites`)).json, { open: 2 }) }) },
    { label: pair('Raw details', '原始資料'), icon: 'data_object', run: () => dialog({ title: d.name, wide: true, body: jsonTree(d, { open: 1 }) }) },
    '-',
    { label: pair('Expire key', '令鎖匙過期'), icon: 'timer', danger: true, run: () => act('Expire', [d], () => api('POST', `/device/${d.id}/expire`), { destructive: true }) },
    { label: pair('Delete device', '刪除裝置'), icon: 'delete', danger: true, run: () => act('Delete', [d], () => api('DELETE', `/device/${d.id}`), { destructive: true }) }
  ]);
  load();
  return h('div.stack', h('div.row', search.el, h('button.btn.outline', { on: { click: load } }, icon('refresh'), t('refresh'))), wrap);
}

// ---------------- policy file ----------------
function policyView() {
  const ed = h('textarea.input', { style: { minHeight: '460px' }, spellcheck: false, 'aria-label': pair('Policy file (HuJSON)', '政策檔（HuJSON）') });
  const status = h('div.small.muted');
  let etag = null;
  const load = async () => { try { const r = await api('GET', '/tailnet/{tailnet}/acl', { accept: 'application/hujson' }); ed.value = r.text; etag = r.etag; status.textContent = pair(`Loaded ${new Date().toLocaleTimeString()} · ETag ${etag || 'none'}`, `已載入 · ETag ${etag || '無'}`); } catch (e) { status.textContent = e.message; } };
  const validate = async () => { try { const r = await api('POST', '/tailnet/{tailnet}/acl/validate', { body: ed.value }); const msg = r.json?.message; toast(msg || pair('The policy file is valid and its tests pass.', '政策檔有效，測試通過。'), { kind: msg ? 'warn' : 'ok' }); if (r.json && Object.keys(r.json).length) dialog({ title: pair('Validation result', '驗證結果'), wide: true, body: jsonTree(r.json, { open: 3 }) }); } catch (e) { toast(e.message, { kind: 'err' }); } };
  const save = async () => { if (!(await superConfirm({ action: pair('Replace the tailnet policy file', '取代 tailnet 政策檔'), affects: pair('Access rules for every device and user in the tailnet.', '全 tailnet 所有裝置同用戶嘅存取規則。') }))) return; try { await api('POST', '/tailnet/{tailnet}/acl', { body: ed.value }); toast(pair('Policy file saved.', '政策檔已儲存。'), { kind: 'ok' }); window.mt.history.record('Policy file saved', { 'policy.hujson': ed.value }).catch(() => {}); load(); } catch (e) { toast(e.message, { kind: 'err' }); } };
  const pType = segmented([{ value: 'user', label: pair('User', '用戶') }, { value: 'ipport', label: 'IP:port' }], 'user', { label: 'Preview type' });
  const pFor = text('', { label: 'Preview for', mono: true, placeholder: 'user@example.com or 100.64.0.1:22' });
  const preview = async () => { try { const r = await api('POST', '/tailnet/{tailnet}/acl/preview', { query: { type: pType.get(), previewFor: pFor.get() }, body: ed.value }); dialog({ title: pair('Rule matches', '規則配對'), wide: true, body: jsonTree(r.json, { open: 3 }) }); } catch (e) { toast(e.message, { kind: 'err' }); } };
  ed.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); const s = ed.selectionStart; ed.setRangeText('  ', s, ed.selectionEnd, 'end'); } if (e.ctrlKey && e.key === 's') { e.preventDefault(); save(); } });
  load();
  return h('div.stack', h('div.row', h('button.btn.outline', { on: { click: load } }, icon('refresh'), pair('Reload', '重新載入')), h('button.btn.tonal', { on: { click: validate } }, icon('rule'), pair('Validate and test', '驗證同測試')), h('button.btn', { on: { click: save } }, icon('save'), pair('Save (Ctrl+S)', '儲存（Ctrl+S）')), exportMenu(() => ({ name: 'policy', data: ed.value, text: ed.value })), status), ed,
    h('div.card.tonal', h('h3', pair('Preview rule matches', '預覽規則配對')), h('div.row', pType.el), pFor.el, h('div.row', h('button.btn.small', { on: { click: preview } }, icon('preview'), pair('Preview', '預覽')))));
}

// ---------------- auth keys ----------------
function keysView() {
  const list = h('div.stack');
  const load = async () => {
    clear(list).append(h('div.skeleton', { style: { height: '80px' } }));
    try {
      const keys = (await api('GET', '/tailnet/{tailnet}/keys', { query: { all: true } })).json.keys || [];
      clear(list);
      if (!keys.length) list.append(h('div.empty', icon('key_off'), pair('No keys.', '冇鎖匙。')));
      for (const k of keys) list.append(h('div.pick-row', { style: { cursor: 'default' } }, h('span.ava', icon(k.keyType === 'client' ? 'badge' : 'key')), h('span.meta', h('b', k.description || k.id), h('span', `${k.keyType || 'auth'} · ${pair('expires', '到期')} ${k.expires ? new Date(k.expires).toLocaleDateString() : '—'} ${k.revoked ? '· revoked' : ''}`)),
        h('button.icon-btn.sm', { 'aria-label': pair('Details', '詳情'), on: { click: async () => dialog({ title: k.id, wide: true, body: jsonTree((await api('GET', `/tailnet/{tailnet}/keys/${k.id}`)).json, { open: 3 }) }) } }, icon('info')),
        h('button.icon-btn.sm', { 'aria-label': pair('Delete key', '刪除鎖匙'), on: { click: async () => { if (await superConfirm({ action: pair(`Revoke key ${k.id}`, `撤銷鎖匙 ${k.id}`), affects: k.description || '' })) { await api('DELETE', `/tailnet/{tailnet}/keys/${k.id}`).catch((e) => toast(e.message, { kind: 'err' })); load(); } } } }, icon('delete'))));
    } catch (e) { clear(list).append(h('div.err-text', e.message)); }
  };
  const desc = text('', { label: 'Description', placeholder: 'build server' });
  const reusable = switchCtl(false, { label: 'Reusable' }), ephemeral = switchCtl(false, { label: 'Ephemeral' }), pre = switchCtl(true, { label: 'Pre-approved' });
  const tags = chips([], { kind: 'tags', label: 'Tags', suggestions: ['tag:server', 'tag:ci'] });
  const days = stepper(90, { min: 1, max: 90, label: 'Expiry (days)', chips: [{ value: 1 }, { value: 7 }, { value: 30 }, { value: 90 }] });
  const create = async () => {
    try {
      const r = await api('POST', '/tailnet/{tailnet}/keys', { body: { description: desc.get() || undefined, expirySeconds: (days.get() || 90) * 86400, capabilities: { devices: { create: { reusable: reusable.get(), ephemeral: ephemeral.get(), preauthorized: pre.get(), tags: tags.get() } } } } });
      const key = r.json.key;
      dialog({ title: pair('New auth key', '新驗證鎖匙'), emojiChar: '🔑', body: h('div.stack', h('p', pair('Copy it now. Tailscale shows it only once.', '即刻複製，Tailscale 只顯示一次。')), h('div.cmdline', key)), actions: [{ label: t('copy'), run: () => { navigator.clipboard.writeText(key); toast(t('copied'), { kind: 'ok' }); } }] });
      load();
    } catch (e) { toast(e.message, { kind: 'err' }); }
  };
  const sw = (lbl, c) => h('div.switch-row', h('div.txt', h('b', lbl)), c.el);
  load();
  return h('div.grid', h('section.card.span-7', h('div.card-head', h('h3', pair('Keys', '鎖匙')), h('button.btn.small.outline', { on: { click: load } }, icon('refresh'))), list),
    h('section.card.span-5.tonal', h('h3', pair('Create an auth key', '建立驗證鎖匙')), desc.el, sw(pair('Reusable', '可重用'), reusable), sw(pair('Ephemeral', '臨時'), ephemeral), sw(pair('Pre-approved', '預先批准'), pre), h('b', pair('Tags', '標籤')), tags.el, h('b', pair('Expires after (days)', '幾多日後過期')), days.el, h('div.row', h('button.btn', { on: { click: create } }, icon('add'), pair('Create key', '建立鎖匙')))));
}

// ---------------- settings via schema + current values ----------------
function settingsView() {
  const box = h('div.stack');
  (async () => {
    await getCatalog();
    const getOp = opById(catalog.operations.find((o) => o.method === 'GET' && o.path === '/tailnet/{tailnet}/settings').id);
    const patchOp = catalog.operations.find((o) => o.method === 'PATCH' && o.path === '/tailnet/{tailnet}/settings');
    let cur = {};
    try { cur = (await api('GET', getOp.path)).json || {}; } catch (e) { box.append(h('div.err-text', e.message)); }
    const ctl = schemaControl(patchOp.body, cur, { name: 'settings' });
    box.append(h('p.small.muted', pair('Every tailnet setting the API exposes, prefilled with the current values. Only changed values are sent.', 'API 提供嘅每個 tailnet 設定，已填入現值。只會傳送改咗嘅值。')), ctl.el,
      h('div.row', h('button.btn', { on: { click: async () => {
        const v = ctl.get() || {};
        const diff = Object.fromEntries(Object.entries(v).filter(([k, x]) => JSON.stringify(x) !== JSON.stringify(cur[k])));
        if (!Object.keys(diff).length) { toast(pair('Nothing changed.', '冇改動。')); return; }
        try { await api('PATCH', patchOp.path, { body: diff }); toast(pair(`Saved ${Object.keys(diff).length} setting(s).`, `已儲存 ${Object.keys(diff).length} 項設定。`), { kind: 'ok' }); window.mt.history.record('Tailnet settings changed', { 'tailnet-settings.json': { ...cur, ...diff } }).catch(() => {}); } catch (e) { toast(e.message, { kind: 'err' }); }
      } } }, icon('save'), pair('Save changes', '儲存改動'))));
  })();
  return box;
}

// ---------------- generic endpoint explorer ----------------
export function opForm(op) {
  const pathCtl = {}, queryCtl = {};
  const params = h('div.flags-grid');
  for (const p of op.params) {
    if (p.in === 'path' && p.name === 'tailnet') continue;
    const c = schemaControl(p.schema, p.schema?.default, { name: p.name, depth: 1 });
    (p.in === 'path' ? pathCtl : queryCtl)[p.name] = c;
    params.append(h('div.flag-card', h('div.row.nowrap', infoBtn(p.name, clean(p.description) || p.name), h('b', { style: { flex: 1 } }, p.name), h('span.badge.' + (p.required ? 'warn' : 'info'), `${p.in}${p.required ? ' · required' : ''}`)), c.el, p.description ? h('div.small.muted', clean(p.description).slice(0, 220)) : null));
  }
  const body = op.body ? schemaControl(op.body, undefined, { name: op.bodyMediaType?.includes('hujson') ? 'policy' : 'body' }) : null;
  const out = h('div.stack');
  const run = h('button.btn' + (op.destructive ? '.danger' : ''), { on: { click: async () => {
    const pp = Object.fromEntries(Object.entries(pathCtl).map(([k, c]) => [k, c.get()]));
    const qq = Object.fromEntries(Object.entries(queryCtl).map(([k, c]) => [k, c.get()]).filter(([, v]) => v !== undefined));
    clear(out).append(h('div.skeleton', { style: { height: '60px' } }));
    try {
      const r = await runOp(op, { pathParams: pp, query: qq, body: body?.get() });
      clear(out);
      if (!r) return;
      out.append(h('div.row', h('span.badge.ok', `HTTP ${r.status}`), h('span.small.muted', `${r.ms} ms`), h('span.spacer'), exportMenu(() => ({ name: op.id, data: r.json ?? r.text, text: r.text }))), r.json !== undefined && r.json !== null ? h('div.out', jsonTree(r.json, { open: 2 })) : h('div.out', r.text || pair('No content.', '冇內容。')));
      sound('success');
    } catch (e) { clear(out).append(h('div.err-text', e.message)); sound('error'); }
  } } }, icon(op.destructive ? 'delete_forever' : 'send'), `${op.method}`);
  return h('div.stack', h('div.row', h('span.badge.' + ({ GET: 'ok', DELETE: 'err', POST: 'info', PUT: 'warn', PATCH: 'warn' }[op.method]), op.method), h('code', op.path), op.destructive ? h('span.badge.err', pair('destructive', '危險')) : null),
    op.description ? collapsible(`op-desc-${op.id}`, pair('Description', '說明'), h('div.small', { style: { whiteSpace: 'pre-wrap' } }, clean(op.description).slice(0, 2000)), { startCollapsed: true }) : null,
    op.params.filter((p) => p.name !== 'tailnet').length ? h('div.stack', h('h3', pair('Parameters', '參數')), params) : null,
    body ? h('div.stack', h('h3', pair('Request body', '請求內容')), body.el) : null,
    h('div.row', run), out);
}

function explorer() {
  const box = h('div.stack');
  const search = regexField({ id: 'admin-explorer', placeholder: pair('Search 93 API operations', '搜尋 93 個 API 操作'), onChange: () => draw() });
  const draw = async () => {
    await getCatalog();
    clear(box);
    const { q, re } = search.value();
    const test = (s) => { if (!q) return true; if (re) { try { return new RegExp(q, 'i').test(s); } catch { return true; } } return s.toLowerCase().includes(q.toLowerCase()); };
    const tags = [...new Set(catalog.operations.map((o) => o.tag))];
    for (const tg of tags) {
      const ops = catalog.operations.filter((o) => o.tag === tg && test(`${o.summary} ${o.path} ${o.method} ${o.description}`));
      if (!ops.length) continue;
      box.append(h('h2', pair(tg.replace(/([a-z])([A-Z])/g, '$1 $2'), TAG_YUE[tg])), ...ops.map((op) => collapsible(`op-${op.id}`, h('span', h('span.badge.' + ({ GET: 'ok', DELETE: 'err' }[op.method] || 'info'), { style: { marginRight: '8px' } }, op.method), op.summary), h('div.card', opForm(op)), { startCollapsed: true })));
    }
  };
  draw();
  return h('div.stack', search.el, box);
}

registerPage('admin', (ctx) => {
  const views = { Devices: devicesView, Policy: policyView, Keys: keysView, DNS: () => tagPane('DNS'), Users: () => tagPane('Users'), Settings: settingsView, Webhooks: () => tagPane('Webhooks'), Logs: () => tagPane('Logging'), Services: () => tagPane('Services'), Posture: () => tagPane('DevicePosture'), Invites: () => h('div.stack', tagPane('UserInvites'), tagPane('DeviceInvites')), Contacts: () => tagPane('Contacts'), OAuth: () => tagPane('OAuthApps'), Organizations: () => tagPane('Organizations'), Everything: explorer };
  const yue = { Devices: '裝置', Policy: '政策檔', Keys: '鎖匙', DNS: 'DNS', Users: '用戶', Settings: '設定', Webhooks: 'Webhook', Logs: '日誌', Services: '服務', Posture: '裝置狀態', Invites: '邀請', Contacts: '聯絡人', OAuth: 'OAuth', Organizations: '組織', Everything: '全部端點' };
  let cur = views[ctx.arg] ? ctx.arg : 'Devices';
  const holder = h('div');
  const seg = segmented(Object.keys(views).map((k) => ({ value: k, label: pair(k, yue[k]) })), cur, { label: 'Admin area' });
  const show = () => clear(holder).append(views[cur]());
  seg.onChange((v) => { cur = v; show(); });
  const page = h('div.page', h('div.page-head', h('div.titles', h('div.eyebrow', 'api.tailscale.com'), h('h1', t('admin')), h('p', pair('The whole Tailscale admin API: devices, policy file, keys, DNS, users, settings, webhooks, logs, services, posture, invites, contacts, OAuth apps and organisations. 93 operations, every field a rich control.', '成個 Tailscale 管理 API：93 個操作，每個欄位都有專屬控制項。')))),
    connectionCard(() => show()), h('div.card.tonal', seg.el), holder);
  show();
  return page;
});

function tagPane(tag) {
  const box = h('div.stack');
  getCatalog().then(() => {
    const ops = catalog.operations.filter((o) => o.tag === tag);
    ops.forEach((op, i) => box.append(collapsible(`op-${op.id}`, h('span', h('span.badge.' + ({ GET: 'ok', DELETE: 'err' }[op.method] || 'info'), { style: { marginRight: '8px' } }, op.method), op.summary), h('div.card', opForm(op)), { startCollapsed: i > 0 })));
  });
  return box;
}
