// Built-in extension: copies `tailscale ssh <device>` for the chosen device.
// Protocol: one JSON request on standard input, one JSON answer on standard output.
'use strict';
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', () => {
  const req = JSON.parse(input);
  const say = (en, yue) => (req.language === 'yue' ? yue : req.language === 'both' ? `${en} · ${yue}` : en);
  const p = req.peer || {};
  const target = p.dnsName || (p.addresses || [])[0];
  if (!target) {
    process.stdout.write(JSON.stringify({ ok: false, message: say('This device has no MagicDNS name or address to connect to.', '呢部裝置冇 MagicDNS 名或者位址可以連。') }));
    return;
  }
  const command = `tailscale ssh ${target}`;
  const note = p.online ? '' : ` ${say('It is offline right now.', '佢而家離線。')}`;
  process.stdout.write(JSON.stringify({ ok: true, copy: command, message: say(`Copied "${command}".`, `已複製「${command}」。`) + note }));
});
