// Built-in extension: plain-language health checks for Diagnostics.
'use strict';
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', () => {
  const req = JSON.parse(input);
  const say = (en, yue) => (req.language === 'yue' ? yue : req.language === 'both' ? `${en} · ${yue}` : en);
  const s = req.status || {};
  const checks = [];
  const add = (state, title, detail) => checks.push({ state, title, detail });

  if (s.state === 'Running') add('ok', say('Tailscale is connected', 'Tailscale 已連線'), say('The connection is up.', '連線正常。'));
  else if (s.state === 'NeedsLogin') add('fail', say('Tailscale needs you to sign in', 'Tailscale 要你登入'), say('Sign in from Accounts or run tailscale login.', '喺帳戶登入，或者執行 tailscale login。'));
  else add('warn', say('Tailscale is not connected', 'Tailscale 未連線'), say(`Current state: ${s.state || 'unknown'}.`, `而家嘅狀態：${s.state || '未知'}。`));

  const exp = s.self && s.self.keyExpiry ? new Date(s.self.keyExpiry) : null;
  if (!exp || Number.isNaN(exp.getTime())) add('ok', say("This device's key does not expire", '本機金鑰唔會到期'), say('Key expiry is off for this device, or not reported.', '呢部裝置冇開金鑰到期，或者冇報告。'));
  else {
    const days = Math.floor((exp - Date.now()) / 86400000);
    if (days < 0) add('fail', say("This device's key has expired", '本機金鑰已經到期'), say('Sign in again to renew it.', '重新登入就可以續期。'));
    else if (days <= 30) add('warn', say(`This device's key expires in ${days} days`, `本機金鑰 ${days} 日後到期`), say('Renew it by signing in again, or turn key expiry off in the admin console.', '重新登入續期，或者喺管理主控台關閉金鑰到期。'));
    else add('ok', say(`This device's key is good for ${days} more days`, `本機金鑰仲有 ${days} 日先到期`));
  }

  if (s.exitNode) add('ok', say(`Internet traffic goes through ${s.exitNode.name || s.exitNode.dnsName}`, `上網流量經 ${s.exitNode.name || s.exitNode.dnsName}`));
  else add('ok', say('No exit node in use', '冇用出口節點'), say('Internet traffic goes out directly from this device.', '上網流量直接由本機出去。'));

  const d = s.devices || { total: 0, online: 0 };
  if (d.total === 0) add('warn', say('No other devices in this tailnet', '呢個 tailnet 冇其他裝置'), say('Add a device to start connecting.', '加部裝置就可以開始連線。'));
  else if (d.online === 0) add('warn', say(`None of ${d.total} devices is online`, `${d.total} 部裝置一部都唔在線`));
  else add('ok', say(`${d.online} of ${d.total} devices are online`, `${d.total} 部裝置有 ${d.online} 部在線`));

  const health = s.health || [];
  if (!health.length) add('ok', say('No health warnings', '冇健康警告'));
  else add('warn', say(`${health.length} health warning${health.length > 1 ? 's' : ''}`, `${health.length} 個健康警告`), health[0]);

  if (s.version) add('ok', say(`Tailscale ${String(s.version).split('-')[0]}`, `Tailscale ${String(s.version).split('-')[0]}`));
  process.stdout.write(JSON.stringify({ ok: true, checks }));
});
