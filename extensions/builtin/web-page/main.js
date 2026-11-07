// Built-in extension: opens http://<device>/ in the browser.
'use strict';
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', () => {
  const req = JSON.parse(input);
  const say = (en, yue) => (req.language === 'yue' ? yue : req.language === 'both' ? `${en} · ${yue}` : en);
  const p = req.peer || {};
  const v4 = (p.addresses || []).find((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a));
  const host = p.dnsName || v4;
  if (!host) { process.stdout.write(JSON.stringify({ ok: false, message: say('This device has no name or IPv4 address to open.', '呢部裝置冇名或者 IPv4 位址可以開。') })); return; }
  const url = `http://${host}/`;
  process.stdout.write(JSON.stringify({ ok: true, openUrl: url, message: p.online ? say(`Opening ${url}`, `打開緊 ${url}`) : say(`Opening ${url}, but the device is offline right now.`, `打開緊 ${url}，不過裝置而家離線。`) }));
});
