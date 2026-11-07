// Sample Material Tailscale extension in JavaScript, run by the app's own runtime.
// Reads one JSON request from standard input and writes one JSON answer to standard output.
'use strict';
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', () => {
  const { status } = JSON.parse(input);
  const { total = 0, online = 0 } = (status && status.devices) || {};
  const share = total ? Math.round((online / total) * 100) : 0;
  const state = total && online * 2 >= total ? 'ok' : 'warn';
  process.stdout.write(JSON.stringify({ ok: true, checks: [{ state, title: `${share}% of devices are online`, detail: `${online} of ${total} devices answered the last status poll.` }] }));
});
