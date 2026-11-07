// Built-in extension: copies a Markdown summary of the chosen device.
'use strict';
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', () => {
  const req = JSON.parse(input);
  const say = (en, yue) => (req.language === 'yue' ? yue : req.language === 'both' ? `${en} · ${yue}` : en);
  const p = req.peer || {};
  const lines = [
    `### ${p.name || p.dnsName || say('Device', '裝置')}`,
    '',
    `- ${say('MagicDNS name', 'MagicDNS 名')}: ${p.dnsName || '-'}`,
    `- ${say('Addresses', '位址')}: ${(p.addresses || []).join(', ') || '-'}`,
    `- ${say('System', '系統')}: ${p.os || '-'}`,
    `- ${say('State', '狀態')}: ${p.online ? say('online', '在線') : say(`offline, last seen ${p.lastSeen || 'unknown'}`, `離線，最後見到 ${p.lastSeen || '未知'}`)}`,
    `- ${say('Tags', '標籤')}: ${(p.tags || []).join(', ') || '-'}`,
    `- ${say('Exit node', '出口節點')}: ${p.isExitNode ? say('in use by this device', '本機用緊') : p.offersExitNode ? say('offered', '有提供') : say('no', '冇')}`
  ];
  process.stdout.write(JSON.stringify({ ok: true, copy: lines.join('\n'), message: say('Copied the device summary.', '已複製裝置摘要。') }));
});
