'use strict';
/*
 * The complete Tailscale CLI catalogue. Every subcommand and every documented
 * flag is one entry here, and the renderer turns each flag into a typed rich
 * control (switch, segmented picker, chip editor, peer picker, stepper, slider,
 * file browser). The main process builds argument vectors only from this
 * catalogue, so the renderer can never inject arbitrary arguments through it.
 *
 * Source: https://tailscale.com/kb/1080/cli, /kb/1242/tailscale-serve,
 * /kb/1223/funnel, /kb/1243/tailscale-lock (reviewed 2026-11-06).
 *
 * Flag types:
 *   bool      switch (tri-state "leave unchanged" where the command is `set`)
 *   enum      segmented button group (options)
 *   string    text field with suggestions
 *   int       stepper with min/max
 *   port      port stepper 1-65535 with well-known chips
 *   duration  slider with unit picker (ms, s, m, h)
 *   cidrs     CIDR chip editor with validation and LAN suggestions
 *   tags      tag:chip editor
 *   peer      live peer picker (from status)
 *   exitnode  live exit-node picker (from exit-node list), plus auto:any
 *   account   live account picker (from switch --list)
 *   path      file browse; dir = folder browse; files = multi-file browse
 *   secret    masked field with reveal and file: prefix support
 *   url       URL field with scheme validation
 *   ip        IP address field
 *   keys      tlpub: key chip editor
 *   caps      app capability chip editor
 */

const f = (name, type, desc, extra = {}) => ({ name, type, desc, ...extra });

const ACCEPT_RISK = f('accept-risk', 'enum', 'Skip the confirmation prompt for this risk type.', { options: ['', 'lose-ssh', 'all'], optionLabels: ['Ask me', 'Losing SSH', 'All risks'] });
const NETFILTER = f('netfilter-mode', 'enum', 'Linux netfilter integration mode.', { options: ['on', 'nodivert', 'off'], platforms: ['linux'] });

const PREF_FLAGS = [
  f('accept-dns', 'bool', 'Accept the DNS configuration from the admin console.', { default: true }),
  f('accept-routes', 'bool', 'Accept subnet routes that other nodes advertise.', { defaultNote: 'On for Windows, iOS, Android and macOS app builds; off elsewhere.' }),
  f('advertise-connector', 'bool', 'Offer to be an app connector for domain-based routing.'),
  f('advertise-exit-node', 'bool', 'Offer to be an exit node for internet traffic.', { default: false }),
  f('advertise-routes', 'cidrs', 'Subnet routes to expose to the tailnet. Empty clears them.'),
  f('advertise-tags', 'tags', 'ACL tags to apply to this device (needs TagOwners membership).'),
  f('exit-node', 'exitnode', 'Exit node to route internet traffic through. Empty disables.'),
  f('exit-node-allow-lan-access', 'bool', 'Keep direct access to the local network while using an exit node.', { default: false }),
  f('hostname', 'string', 'Hostname to use instead of the one the operating system provides.'),
  NETFILTER,
  f('nickname', 'string', 'Nickname for the current account.'),
  f('operator', 'string', 'Non-root user allowed to operate tailscaled.', { platforms: ['linux'], default: 'root' }),
  f('report-posture', 'bool', 'Allow device posture identity collection.', { default: false }),
  f('shields-up', 'bool', 'Block all incoming connections from other tailnet devices.'),
  f('snat-subnet-routes', 'bool', 'Source NAT traffic to advertised local routes.', { platforms: ['linux'] }),
  f('ssh', 'bool', 'Run a Tailscale SSH server on this device.', { default: false }),
  f('stateful-filtering', 'bool', 'Stateful filtering of forwarded packets for subnet routers and exit nodes.', { default: false })
];

const pick = (names) => PREF_FLAGS.filter((x) => names.includes(x.name));

const COMMANDS = [
  // ---- Connection ----
  {
    id: 'up', path: ['up'], group: 'connection', title: 'Connect (up)', icon: 'power',
    desc: 'Connect this device to Tailscale and apply the chosen preferences.', output: 'stream',
    flags: [
      ...PREF_FLAGS,
      f('auth-key', 'secret', 'Authenticate with an auth key instead of the browser. file: reads it from a file.'),
      f('client-id', 'string', 'OAuth client ID for workload identity federation.'),
      f('client-secret', 'secret', 'OAuth client secret. file: reads it from a file.'),
      f('id-token', 'secret', 'ID token for workload identity federation. file: reads it from a file.'),
      f('audience', 'string', 'Audience used when requesting an ID token.'),
      f('force-reauth', 'bool', 'Force re-authentication even if already logged in.'),
      f('login-server', 'url', 'Coordination server URL, for example a Headscale server.', { default: 'https://controlplane.tailscale.com' }),
      f('qr', 'bool', 'Show a QR code for the login URL.', { default: false }),
      f('qr-format', 'enum', 'QR code size.', { options: ['small', 'large'], default: 'small' }),
      f('reset', 'bool', 'Reset unspecified settings to their defaults.'),
      f('timeout', 'duration', 'Maximum time to wait for the service to initialise. 0s waits forever.', { default: '0s' }),
      f('unattended', 'bool', 'Keep running after the Windows user logs out.', { platforms: ['win32'] })
    ]
  },
  {
    id: 'down', path: ['down'], group: 'connection', title: 'Disconnect (down)', icon: 'power_off', danger: 'soft',
    desc: 'Disconnect from Tailscale. The device stays logged in.',
    flags: [ACCEPT_RISK, f('reason', 'string', 'Reason for disconnecting, when a system policy requires one.')]
  },
  {
    id: 'set', path: ['set'], group: 'connection', title: 'Preferences (set)', icon: 'tune', triState: true,
    desc: 'Change preferences without reconnecting. Only the flags you touch are sent.',
    flags: [
      ...PREF_FLAGS.filter((x) => x.name !== 'advertise-tags'),
      ACCEPT_RISK,
      f('auto-update', 'bool', 'Let the client update itself automatically.'),
      f('relay-server-port', 'port', 'UDP port for this node to act as a peer relay. 0 picks a random port, empty disables.', { allowEmpty: true, allowZero: true }),
      f('relay-server-static-endpoints', 'bool', 'Use static endpoints for peer relays.'),
      f('update-check', 'bool', 'Notify when a client update is available.'),
      f('webclient', 'bool', 'Persistently expose the web interface on port 5252.'),
      f('unattended', 'bool', 'Keep running after the Windows user logs out.', { platforms: ['win32'] })
    ]
  },
  {
    id: 'get', path: ['get'], group: 'connection', title: 'Read preferences (get)', icon: 'manage_search', output: 'json',
    desc: 'Read one preference or all of them.',
    positionals: [{ name: 'setting', type: 'enum', options: ['all', ...PREF_FLAGS.map((x) => x.name), 'auto-update', 'update-check', 'webclient', 'relay-server-port'], default: 'all' }],
    flags: [f('json', 'bool', 'JSON output.', { default: true }), f('set-flags', 'bool', 'Print the values as tailscale set flags.')]
  },
  {
    id: 'login', path: ['login'], group: 'account', title: 'Log in / add account', icon: 'login', output: 'stream',
    desc: 'Log in to a Tailscale account, or add another account to this device.',
    flags: [
      ...PREF_FLAGS,
      f('auth-key', 'secret', 'Authenticate with an auth key. file: reads it from a file.'),
      f('client-id', 'string', 'OAuth client ID for workload identity federation.'),
      f('client-secret', 'secret', 'OAuth client secret. file: reads it from a file.'),
      f('id-token', 'secret', 'ID token for workload identity federation. file: reads it from a file.'),
      f('audience', 'string', 'Audience used when requesting an ID token.'),
      f('login-server', 'url', 'Coordination server URL.', { default: 'https://controlplane.tailscale.com' }),
      f('qr', 'bool', 'Show a QR code for the login URL.', { default: false }),
      f('qr-format', 'enum', 'QR code size.', { options: ['small', 'large'], default: 'small' }),
      f('timeout', 'duration', 'Maximum wait for the service to initialise. 0s waits forever.', { default: '0s' }),
      f('unattended', 'bool', 'Keep running after the Windows user logs out.', { platforms: ['win32'] })
    ]
  },
  { id: 'logout', path: ['logout'], group: 'account', title: 'Log out', icon: 'logout', danger: 'hard', desc: 'Disconnect and expire the current login. The node key is invalidated.', flags: [f('reason', 'string', 'Reason, when a system policy requires one.')] },
  { id: 'switch-list', path: ['switch'], group: 'account', title: 'List accounts', icon: 'group', output: 'json', fixed: ['--list', '--json'], desc: 'List every account logged in on this device.' },
  { id: 'switch', path: ['switch'], group: 'account', title: 'Switch account', icon: 'swap_horiz', desc: 'Switch to another logged-in account.', positionals: [{ name: 'account', type: 'account', required: true }] },
  { id: 'switch-remove', path: ['switch', 'remove'], group: 'account', title: 'Remove account', icon: 'person_remove', danger: 'hard', desc: 'Remove a logged-in account from this device (alpha).', positionals: [{ name: 'id', type: 'account', required: true }] },
  { id: 'whoami', path: ['whoami'], group: 'account', title: 'Who am I', icon: 'badge', output: 'json', desc: 'Show the current user and node.', flags: [f('json', 'bool', 'JSON output.', { default: true })] },

  // ---- Status and diagnostics ----
  {
    id: 'status', path: ['status'], group: 'status', title: 'Status', icon: 'hub', output: 'json',
    desc: 'Show the connection state of this device and every peer.',
    flags: [
      f('json', 'bool', 'JSON output.', { default: true }),
      f('active', 'bool', 'Only show peers with active sessions.'),
      f('peers', 'bool', 'Show peers.', { default: true }),
      f('self', 'bool', 'Show this device.', { default: true }),
      f('header', 'bool', 'Show column headers in the table.', { default: false }),
      f('web', 'bool', 'Run a local web status page instead.'),
      f('listen', 'string', 'Web status listen address. Port 0 picks one.', { default: '127.0.0.1:8384' }),
      f('browser', 'bool', 'Open a browser in web mode.', { default: true })
    ]
  },
  {
    id: 'ping', path: ['ping'], group: 'status', title: 'Ping', icon: 'network_ping', output: 'stream',
    desc: 'Ping a peer at the Tailscale layer and report the path taken.',
    positionals: [{ name: 'target', type: 'peer', required: true }],
    flags: [
      f('c', 'int', 'Maximum number of pings.', { default: 10, min: 0, max: 1000 }),
      f('icmp', 'bool', 'ICMP-level ping through WireGuard.', { default: false }),
      f('peerapi', 'bool', 'Ping the peer\'s PeerAPI HTTP server.', { default: false }),
      f('tsmp', 'bool', 'TSMP-level ping through WireGuard.', { default: false }),
      f('size', 'int', 'Payload size in bytes. 0 is the minimum.', { min: 0, max: 1400 }),
      f('timeout', 'duration', 'Maximum wait per ping.', { default: '5s' }),
      f('until-direct', 'bool', 'Stop once a direct path is found.', { default: true }),
      f('verbose', 'bool', 'Verbose output.', { default: false })
    ]
  },
  {
    id: 'netcheck', path: ['netcheck'], group: 'status', title: 'Network check', icon: 'speed', output: 'json',
    desc: 'Report UDP, NAT type, IPv6 and latency to every DERP relay region.',
    flags: [
      f('format', 'enum', 'Output format.', { options: ['json', 'json-line', ''], optionLabels: ['JSON', 'JSON lines', 'Text'], default: 'json' }),
      f('every', 'duration', 'Run repeatedly at this interval.'),
      f('verbose', 'bool', 'Verbose logs.'),
      f('bind-address', 'ip', 'Local IP address to bind probes to.'),
      f('bind-port', 'port', 'Local UDP port to bind probes to.', { allowZero: true })
    ]
  },
  {
    id: 'ip', path: ['ip'], group: 'status', title: 'Tailscale IPs', icon: 'pin', desc: 'Show the Tailscale IP addresses of this device or a peer.',
    positionals: [{ name: 'peer', type: 'peer' }],
    flags: [f('4', 'bool', 'IPv4 only.'), f('6', 'bool', 'IPv6 only.'), f('1', 'bool', 'One address, IPv4 preferred.'), f('assert', 'ip', 'Fail unless the node has this IP.')]
  },
  {
    id: 'whois', path: ['whois'], group: 'status', title: 'Who is', icon: 'person_search', output: 'json', desc: 'Look up the machine and user behind a Tailscale IP.',
    flags: [f('json', 'bool', 'JSON output.', { default: true, first: true }), f('proto', 'enum', 'Protocol for the lookup.', { options: ['', 'tcp', 'udp'], optionLabels: ['Both', 'TCP', 'UDP'] })],
    positionals: [{ name: 'ip[:port]', type: 'peer', required: true, preferIp: true }]
  },
  { id: 'wait', path: ['wait'], group: 'status', title: 'Wait for running', icon: 'hourglass_top', desc: 'Wait until Tailscale is running.', flags: [f('timeout', 'duration', 'Timeout. 0 waits forever.')] },
  {
    id: 'version', path: ['version'], group: 'status', title: 'Version', icon: 'info', output: 'json', desc: 'Client, daemon and upstream versions.',
    flags: [f('json', 'bool', 'JSON output.', { default: true }), f('daemon', 'bool', 'Also print the daemon version.'), f('upstream', 'bool', 'Print the latest upstream version.'), f('track', 'enum', 'Track to check.', { options: ['', 'stable', 'release-candidate', 'unstable'], optionLabels: ['Current', 'Stable', 'Release candidate', 'Unstable'] })]
  },
  { id: 'metrics-print', path: ['metrics', 'print'], group: 'status', title: 'Client metrics', icon: 'monitoring', desc: 'Show the client metrics in Prometheus text format.' },
  { id: 'metrics-write', path: ['metrics', 'write'], group: 'status', title: 'Write metrics to file', icon: 'save', desc: 'Write the client metrics to a text file.', positionals: [{ name: 'file', type: 'savepath', required: true }] },
  { id: 'bugreport', path: ['bugreport'], group: 'status', title: 'Bug report', icon: 'bug_report', desc: 'Generate a bug report identifier for Tailscale support.', flags: [f('diagnose', 'bool', 'Log extra verbose system information.', { default: false }), f('record', 'bool', 'Create a before and after pair around a reproduction.', { default: false })] },

  // ---- Exit nodes ----
  { id: 'exit-node-list', path: ['exit-node', 'list'], group: 'exit', title: 'List exit nodes', icon: 'list', desc: 'List the exit nodes this device can use.', flags: [f('filter', 'string', 'Only show exit nodes in this country.')] },
  { id: 'exit-node-suggest', path: ['exit-node', 'suggest'], group: 'exit', title: 'Suggest exit node', icon: 'network_check', desc: 'Ask Tailscale for the best exit node right now.' },

  // ---- DNS ----
  { id: 'dns-status', path: ['dns', 'status'], group: 'dns', title: 'DNS status', icon: 'dns', output: 'json', desc: 'Local DNS forwarder and MagicDNS configuration.', flags: [f('json', 'bool', 'JSON output.', { default: true }), f('all', 'bool', 'Advanced debug output.')] },
  {
    id: 'dns-query', path: ['dns', 'query'], group: 'dns', title: 'DNS query', icon: 'travel_explore', output: 'json', desc: 'Run a DNS query through the Tailscale DNS forwarder.',
    positionals: [{ name: 'name', type: 'string', required: true, placeholder: 'nas-01' }, { name: 'type', type: 'enum', options: ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'PTR', 'SRV', 'TXT', 'CAA', 'SOA'], default: 'A' }],
    flags: [f('json', 'bool', 'JSON output.', { default: true, first: true })]
  },

  // ---- Serve and Funnel ----
  {
    id: 'serve', path: ['serve'], group: 'serve', title: 'Serve', icon: 'lan', desc: 'Share a local service, file, folder or text with your tailnet.',
    positionals: [{ name: 'target', type: 'servetarget', required: true }],
    flags: [
      f('bg', 'bool', 'Keep serving in the background, across reboots and up or down.', { default: true }),
      f('https', 'port', 'Expose an HTTPS server on this port (default mode).'),
      f('http', 'port', 'Expose an HTTP server on this port.'),
      f('tcp', 'port', 'Raw TCP forwarder on this port.'),
      f('tls-terminated-tcp', 'port', 'TLS-terminated TCP forwarder on this port.'),
      f('set-path', 'string', 'URL path to mount the target at.', { placeholder: '/' }),
      f('proxy-protocol', 'enum', 'Send a PROXY protocol header for TCP forwarding.', { options: ['', '1', '2'], optionLabels: ['Off', 'v1', 'v2'] }),
      f('service', 'string', 'Serve for a Tailscale Service (svc:name) on its virtual IP.'),
      f('tun', 'bool', 'Forward all traffic to this machine (Services only, layer 3).', { default: false }),
      f('accept-app-caps', 'caps', 'App capabilities to forward to the backend.'),
      f('yes', 'bool', 'Apply without interactive prompts.', { default: true })
    ]
  },
  { id: 'serve-off', path: ['serve'], group: 'serve', title: 'Stop a Serve handler', icon: 'stop_circle', danger: 'soft', desc: 'Turn off one Serve handler. Repeat the flags it was started with.', suffix: ['off'], flags: [f('https', 'port', 'HTTPS port.'), f('http', 'port', 'HTTP port.'), f('tcp', 'port', 'TCP port.'), f('tls-terminated-tcp', 'port', 'TLS-terminated TCP port.'), f('set-path', 'string', 'Mounted path.'), f('service', 'string', 'Tailscale Service name.'), f('yes', 'bool', 'No prompts.', { default: true })] },
  { id: 'serve-status', path: ['serve', 'status'], group: 'serve', title: 'Serve status', icon: 'info', output: 'json', fixed: ['--json'], desc: 'Every running Serve handler.' },
  { id: 'serve-reset', path: ['serve', 'reset'], group: 'serve', title: 'Reset Serve', icon: 'restart_alt', danger: 'hard', desc: 'Clear the entire Serve configuration.' },
  { id: 'serve-drain', path: ['serve', 'drain'], group: 'serve', title: 'Drain a Service', icon: 'water_drop', danger: 'soft', desc: 'Gracefully stop hosting a Tailscale Service here; open connections continue.', positionals: [{ name: 'service', type: 'string', required: true, placeholder: 'svc:my-service' }] },
  { id: 'serve-advertise', path: ['serve', 'advertise'], group: 'serve', title: 'Advertise a Service', icon: 'campaign', desc: 'Make this node a Service host again.', positionals: [{ name: 'service', type: 'string', required: true, placeholder: 'svc:my-service' }] },
  { id: 'serve-get-config', path: ['serve', 'get-config'], group: 'serve', title: 'Export Service config', icon: 'download', desc: 'Export hosted Service configuration to a file.', positionals: [{ name: 'file', type: 'savepath', required: true }], flags: [f('all', 'bool', 'All hosted Services.'), f('service', 'string', 'One Service.')] },
  { id: 'serve-set-config', path: ['serve', 'set-config'], group: 'serve', title: 'Apply Service config', icon: 'upload', desc: 'Apply a Service configuration file.', positionals: [{ name: 'file', type: 'path', required: true }], flags: [f('all', 'bool', 'All hosted Services.'), f('service', 'string', 'One Service.')] },
  { id: 'service-list', path: ['service', 'list'], group: 'serve', title: 'Tailscale Services', icon: 'apps', output: 'json', desc: 'Tailscale Services this node can reach.', flags: [f('json', 'bool', 'JSON output.', { default: true })] },
  {
    id: 'funnel', path: ['funnel'], group: 'serve', title: 'Funnel', icon: 'public', danger: 'soft', desc: 'Share a local service with the whole internet over HTTPS.',
    positionals: [{ name: 'target', type: 'servetarget', required: true }],
    flags: [
      f('bg', 'bool', 'Keep running in the background.', { default: true }),
      f('https', 'enum', 'Public HTTPS port (Funnel allows 443, 8443 and 10000).', { options: ['', '443', '8443', '10000'], optionLabels: ['Default', '443', '8443', '10000'] }),
      f('tcp', 'enum', 'Public TCP port.', { options: ['', '443', '8443', '10000'], optionLabels: ['None', '443', '8443', '10000'] }),
      f('tls-terminated-tcp', 'enum', 'Public TLS-terminated TCP port.', { options: ['', '443', '8443', '10000'], optionLabels: ['None', '443', '8443', '10000'] }),
      f('set-path', 'string', 'URL path to mount the target at.'),
      f('proxy-protocol', 'enum', 'PROXY protocol header.', { options: ['', '1', '2'], optionLabels: ['Off', 'v1', 'v2'] }),
      f('yes', 'bool', 'Apply without prompts.', { default: true })
    ]
  },
  { id: 'funnel-off', path: ['funnel'], group: 'serve', title: 'Stop a Funnel', icon: 'public_off', suffix: ['off'], desc: 'Turn off one Funnel. Repeat the flags it was started with.', flags: [f('https', 'enum', 'HTTPS port.', { options: ['', '443', '8443', '10000'] }), f('tcp', 'enum', 'TCP port.', { options: ['', '443', '8443', '10000'] }), f('set-path', 'string', 'Mounted path.'), f('yes', 'bool', 'No prompts.', { default: true })] },
  { id: 'funnel-status', path: ['funnel', 'status'], group: 'serve', title: 'Funnel status', icon: 'info', output: 'json', fixed: ['--json'], desc: 'Every running Funnel.' },
  { id: 'funnel-reset', path: ['funnel', 'reset'], group: 'serve', title: 'Reset Funnel', icon: 'restart_alt', danger: 'hard', desc: 'Clear the entire Funnel configuration.' },

  // ---- Taildrop ----
  {
    id: 'file-cp', path: ['file', 'cp'], group: 'taildrop', title: 'Send files', icon: 'send', output: 'stream', desc: 'Send files to a device on your tailnet.',
    positionals: [{ name: 'files', type: 'files', required: true }, { name: 'target', type: 'peer', required: true, suffix: ':' }],
    flags: [f('name', 'string', 'Alternate file name on the receiving side.'), f('update-interval', 'duration', 'Progress refresh interval. 0 disables progress.', { default: '250ms' }), f('verbose', 'bool', 'Verbose output.')]
  },
  { id: 'file-targets', path: ['file', 'cp'], group: 'taildrop', title: 'Taildrop targets', icon: 'devices', fixed: ['--targets'], desc: 'Devices that can receive files.' },
  {
    id: 'file-get', path: ['file', 'get'], group: 'taildrop', title: 'Receive files', icon: 'move_to_inbox', output: 'stream', desc: 'Move received files from the Taildrop inbox into a folder.',
    positionals: [{ name: 'directory', type: 'dir', required: true }],
    flags: [f('conflict', 'enum', 'When a file with that name exists.', { options: ['skip', 'overwrite', 'rename'], default: 'rename' }), f('loop', 'bool', 'Keep receiving as files arrive.'), f('wait', 'bool', 'Wait for a file if the inbox is empty.'), f('verbose', 'bool', 'Verbose output.')]
  },

  // ---- Certificates ----
  {
    id: 'cert', path: ['cert'], group: 'cert', title: 'HTTPS certificate', icon: 'verified', desc: 'Get a Let\'s Encrypt certificate for this device\'s MagicDNS name.',
    positionals: [{ name: 'hostname', type: 'certhost', required: true }],
    flags: [f('cert-file', 'savepath', 'Where to write the certificate.'), f('key-file', 'savepath', 'Where to write the private key.'), f('min-validity', 'duration', 'Renew if the certificate expires sooner than this.'), f('serve-demo', 'bool', 'Serve a demo page on :443 with the certificate instead of writing files.')]
  },

  // ---- Tailnet Lock ----
  { id: 'lock-status', path: ['lock', 'status'], group: 'lock', title: 'Lock status', icon: 'lock', output: 'json', desc: 'Tailnet Lock state, trusted keys and this node\'s key.', flags: [f('json', 'bool', 'JSON output.', { default: true })] },
  { id: 'lock-init', path: ['lock', 'init'], group: 'lock', title: 'Initialise Tailnet Lock', icon: 'enhanced_encryption', danger: 'hard', desc: 'Turn on Tailnet Lock with these trusted signing keys (must include this node).', positionals: [{ name: 'keys', type: 'keys', required: true }], flags: [f('confirm', 'bool', 'Skip the confirmation prompt.', { default: true }), f('gen-disablements', 'int', 'Number of disablement secrets to generate.', { default: 1, min: 1, max: 20 }), f('gen-disablement-for-support', 'bool', 'Also generate a disablement secret for Tailscale support.')] },
  { id: 'lock-add', path: ['lock', 'add'], group: 'lock', title: 'Add trusted keys', icon: 'key', desc: 'Trust more signing keys.', positionals: [{ name: 'keys', type: 'keys', required: true }] },
  { id: 'lock-remove', path: ['lock', 'remove'], group: 'lock', title: 'Remove trusted keys', icon: 'key_off', danger: 'hard', desc: 'Stop trusting signing keys.', positionals: [{ name: 'keys', type: 'keys', required: true }], flags: [f('re-sign', 'bool', 'Re-sign signatures the removal would invalidate.', { default: true })] },
  { id: 'lock-sign', path: ['lock', 'sign'], group: 'lock', title: 'Sign a node or auth key', icon: 'draw', desc: 'Sign a node key (with an optional rotation key) or a pre-signed auth key.', positionals: [{ name: 'node-key or auth-key', type: 'secret', required: true }, { name: 'rotation-key', type: 'string' }] },
  { id: 'lock-disable', path: ['lock', 'disable'], group: 'lock', title: 'Disable Tailnet Lock', icon: 'lock_open', danger: 'hard', desc: 'Turn off Tailnet Lock for the whole tailnet with a disablement secret.', positionals: [{ name: 'disablement-secret', type: 'secret', required: true }] },
  { id: 'lock-local-disable', path: ['lock', 'local-disable'], group: 'lock', title: 'Disable on this node only', icon: 'no_encryption', danger: 'hard', desc: 'Stop enforcing Tailnet Lock on this device only.' },
  { id: 'lock-disablement-kdf', path: ['lock', 'disablement-kdf'], group: 'lock', title: 'Disablement KDF', icon: 'functions', desc: 'Compute the disablement value from a hex secret (advanced).', positionals: [{ name: 'hex-secret', type: 'secret', required: true }] },
  { id: 'lock-log', path: ['lock', 'log'], group: 'lock', title: 'Lock log', icon: 'history', output: 'json', desc: 'Recent changes to the Tailnet Lock authority.', flags: [f('json', 'bool', 'JSON output.', { default: true }), f('limit', 'int', 'Maximum number of changes.', { default: 50, min: 1, max: 1000 })] },
  { id: 'lock-revoke-keys', path: ['lock', 'revoke-keys'], group: 'lock', title: 'Revoke compromised keys', icon: 'gpp_bad', danger: 'hard', desc: 'Revoke compromised signing keys and recover the authority.', positionals: [{ name: 'keys', type: 'keys', required: true }], flags: [f('cosign', 'bool', 'Continue a revocation started on another signing node.'), f('finish', 'bool', 'Finish the recovery and transmit the revocation.'), f('fork-from', 'string', 'AUM hash to fork from (advanced).')] },

  // ---- Taildrive ----
  { id: 'drive-list', path: ['drive', 'list'], group: 'drive', title: 'Taildrive shares', icon: 'folder_shared', desc: 'Folders this device shares with Taildrive.' },
  { id: 'drive-share', path: ['drive', 'share'], group: 'drive', title: 'Share a folder', icon: 'create_new_folder', desc: 'Share a folder (or change an existing share).', positionals: [{ name: 'name', type: 'string', required: true, placeholder: 'docs' }, { name: 'path', type: 'dir', required: true }] },
  { id: 'drive-rename', path: ['drive', 'rename'], group: 'drive', title: 'Rename a share', icon: 'drive_file_rename_outline', desc: 'Rename a Taildrive share.', positionals: [{ name: 'old name', type: 'string', required: true }, { name: 'new name', type: 'string', required: true }] },
  { id: 'drive-unshare', path: ['drive', 'unshare'], group: 'drive', title: 'Stop sharing', icon: 'folder_off', danger: 'soft', desc: 'Remove a Taildrive share.', positionals: [{ name: 'name', type: 'string', required: true }] },

  // ---- App connectors, policy, system ----
  { id: 'appc-routes', path: ['appc-routes'], group: 'system', title: 'App connector routes', icon: 'alt_route', desc: 'Routes learned by this app connector.', flags: [f('all', 'bool', 'Learned domains, routes and policy routes.'), f('map', 'bool', 'The learned-domain map.'), f('n', 'bool', 'Only the number of advertised routes.')] },
  { id: 'syspolicy-list', path: ['syspolicy', 'list'], group: 'system', title: 'System policies', icon: 'policy', output: 'json', desc: 'Effective system policies and policy errors.', flags: [f('json', 'bool', 'JSON output.', { default: true })] },
  { id: 'syspolicy-reload', path: ['syspolicy', 'reload'], group: 'system', title: 'Reload system policies', icon: 'sync', output: 'json', desc: 'Reload and reapply system policies.', flags: [f('json', 'bool', 'JSON output.', { default: true })] },
  { id: 'update', path: ['update'], group: 'system', title: 'Update Tailscale', icon: 'system_update', output: 'stream', danger: 'soft', desc: 'Update the Tailscale client.', flags: [f('dry-run', 'bool', 'Show what would happen without updating.'), f('track', 'enum', 'Release track.', { options: ['', 'stable', 'release-candidate', 'unstable'], optionLabels: ['Current', 'Stable', 'Release candidate', 'Unstable'] }), f('version', 'string', 'Exact version to install or downgrade to.'), f('yes', 'bool', 'Update without prompts.', { default: true })] },
  { id: 'web', path: ['web'], group: 'system', title: 'Local web interface', icon: 'web', output: 'stream', desc: 'Run the Tailscale web interface locally.', flags: [f('listen', 'string', 'Listen address. Port 0 picks one.', { default: 'localhost:8088' }), f('readonly', 'bool', 'Read-only mode.'), f('cgi', 'bool', 'Run as a CGI script.', { default: false }), f('origin', 'string', 'Origin hostname when behind a proxy.'), f('prefix', 'string', 'URL prefix for requests.')] },
  { id: 'licenses', path: ['licenses'], group: 'system', title: 'Open source licences', icon: 'gavel', desc: 'Open source licence information for Tailscale.' },
  { id: 'configure-kubeconfig', path: ['configure', 'kubeconfig'], group: 'configure', title: 'kubeconfig', icon: 'deployed_code', desc: 'Configure kubectl to reach a Kubernetes operator proxy (alpha).', positionals: [{ name: 'hostname', type: 'peer', required: true }], flags: [f('http', 'bool', 'Use HTTP instead of HTTPS to the auth proxy.')] },
  { id: 'configure-systray', path: ['configure', 'systray'], group: 'configure', title: 'System tray startup', icon: 'widgets', platforms: ['linux'], desc: 'Install a startup script for the Linux system tray.', flags: [f('enable-startup', 'enum', 'Init system.', { options: ['systemd'] })] },
  { id: 'configure-synology', path: ['configure', 'synology'], group: 'configure', title: 'Synology outbound', icon: 'storage', platforms: ['linux'], desc: 'Allow outbound connections on Synology.' },
  { id: 'configure-mac-vpn-install', path: ['configure', 'mac-vpn', 'install'], group: 'configure', title: 'macOS VPN profile: install', icon: 'vpn_key', platforms: ['darwin'], desc: 'Write the VPN configuration to macOS settings.' },
  { id: 'configure-mac-vpn-uninstall', path: ['configure', 'mac-vpn', 'uninstall'], group: 'configure', title: 'macOS VPN profile: remove', icon: 'vpn_key_off', platforms: ['darwin'], danger: 'soft', desc: 'Remove the VPN configuration from macOS settings.' },
  { id: 'configure-sysext-activate', path: ['configure', 'sysext', 'activate'], group: 'configure', title: 'System extension: activate', icon: 'extension', platforms: ['darwin'], desc: 'Register the macOS system extension.' },
  { id: 'configure-sysext-deactivate', path: ['configure', 'sysext', 'deactivate'], group: 'configure', title: 'System extension: deactivate', icon: 'extension_off', platforms: ['darwin'], danger: 'soft', desc: 'Deactivate the macOS system extension.' },
  { id: 'configure-sysext-status', path: ['configure', 'sysext', 'status'], group: 'configure', title: 'System extension: status', icon: 'help', platforms: ['darwin'], desc: 'Status of the macOS system extension.' },
  { id: 'systray', path: ['systray'], group: 'configure', title: 'Linux system tray', icon: 'widgets', platforms: ['linux'], output: 'stream', desc: 'Run the Tailscale system tray icon.', flags: [f('theme', 'enum', 'Icon colour theme.', { options: ['dark', 'dark:nobg', 'light', 'light:nobg'] })] },
  { id: 'completion', path: ['completion'], group: 'configure', title: 'Shell completion', icon: 'terminal', desc: 'Generate a shell completion script.', positionals: [{ name: 'shell', type: 'enum', options: ['bash', 'zsh', 'fish', 'powershell'], default: 'powershell', required: true }], flags: [f('flags', 'bool', 'Also complete flags.', { default: true }), f('descs', 'bool', 'Include descriptions.', { default: true })] },
  { id: 'ssh', path: ['ssh'], group: 'connect', title: 'Tailscale SSH', icon: 'terminal', external: true, desc: 'Open a Tailscale SSH session in a terminal window.', positionals: [{ name: 'user@host', type: 'peer', required: true, allowUser: true }] },
  { id: 'nc', path: ['nc'], group: 'connect', title: 'Netcat to a peer', icon: 'cable', external: true, desc: 'Connect a terminal to a TCP port on a peer.', positionals: [{ name: 'host', type: 'peer', required: true }, { name: 'port', type: 'port', required: true }] }
];

const GROUPS = {
  connection: 'Connection', account: 'Accounts', status: 'Status and diagnostics', exit: 'Exit nodes', dns: 'DNS',
  serve: 'Serve, Funnel and Services', taildrop: 'Taildrop', cert: 'Certificates', lock: 'Tailnet Lock', drive: 'Taildrive',
  system: 'System', configure: 'Configure', connect: 'Connect'
};

/** Global flag accepted by every command. */
const GLOBAL_FLAGS = [f('socket', 'path', 'Path to the tailscaled socket.')];

function findCommand(id) {
  return COMMANDS.find((c) => c.id === id) || null;
}

const DURATION_RE = /^(\d+(\.\d+)?(ns|us|µs|ms|s|m|h))+$/;
const CIDR_RE = /^([0-9]{1,3}(\.[0-9]{1,3}){3}\/\d{1,2}|[0-9a-fA-F:]+\/\d{1,3})$/;

/**
 * Turn a command id plus a values object into an argv array. Throws on any
 * flag or positional the catalogue does not declare or on a malformed value.
 * values: { flags: { name: value }, positionals: [..], global: { socket } }
 */
function buildArgs(id, values = {}) {
  const cmd = findCommand(id);
  if (!cmd) throw new Error(`Unknown command: ${id}`);
  const argv = [];
  const global = values.global || {};
  if (global.socket) argv.push(`--socket=${String(global.socket)}`);
  argv.push(...cmd.path);
  if (cmd.fixed) argv.push(...cmd.fixed);
  const flags = values.flags || {};
  const declared = new Map((cmd.flags || []).map((x) => [x.name, x]));
  const ordered = Object.keys(flags).sort((a, b) => (declared.get(b)?.first ? 1 : 0) - (declared.get(a)?.first ? 1 : 0));
  for (const name of ordered) {
    const spec = declared.get(name);
    if (!spec) throw new Error(`Flag --${name} is not part of tailscale ${cmd.path.join(' ')}`);
    const v = flags[name];
    if (v === undefined || v === null) continue;
    switch (spec.type) {
      case 'bool':
        if (typeof v !== 'boolean') throw new Error(`--${name} must be true or false`);
        argv.push(`--${name}=${v}`);
        break;
      case 'int': case 'port': {
        if (v === '' && spec.allowEmpty) { argv.push(`--${name}=`); break; }
        const n = Number(v);
        if (!Number.isInteger(n)) throw new Error(`--${name} must be a whole number`);
        if (spec.type === 'port' && (n < (spec.allowZero ? 0 : 1) || n > 65535)) throw new Error(`--${name} must be a port between 1 and 65535`);
        if (spec.min !== undefined && n < spec.min) throw new Error(`--${name} must be at least ${spec.min}`);
        if (spec.max !== undefined && n > spec.max) throw new Error(`--${name} must be at most ${spec.max}`);
        argv.push(`--${name}=${n}`);
        break;
      }
      case 'duration':
        if (!DURATION_RE.test(String(v))) throw new Error(`--${name} must be a duration such as 5s or 250ms`);
        argv.push(`--${name}=${v}`);
        break;
      case 'enum':
        if (!spec.options.includes(String(v))) throw new Error(`--${name} must be one of ${spec.options.filter(Boolean).join(', ')}`);
        argv.push(`--${name}=${v}`);
        break;
      case 'cidrs': case 'tags': case 'caps': {
        const list = Array.isArray(v) ? v : String(v).split(',').filter(Boolean);
        if (spec.type === 'cidrs') for (const c of list) if (!CIDR_RE.test(c)) throw new Error(`${c} is not a CIDR route`);
        if (spec.type === 'tags') for (const t of list) if (!/^tag:[A-Za-z0-9-]+$/.test(t)) throw new Error(`${t} is not a tag (tag:name)`);
        argv.push(`--${name}=${list.join(',')}`);
        break;
      }
      default: {
        const s = String(v);
        if (/[\r\n\0]/.test(s)) throw new Error(`--${name} contains a line break`);
        argv.push(`--${name}=${s}`);
      }
    }
  }
  const pos = values.positionals || [];
  (cmd.positionals || []).forEach((p, i) => {
    let v = pos[i];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) {
      if (p.required) throw new Error(`${p.name} is required`);
      return;
    }
    if (p.type === 'enum' && !p.options.includes(String(v))) throw new Error(`${p.name} must be one of ${p.options.join(', ')}`);
    const list = Array.isArray(v) ? v : (p.type === 'keys' ? String(v).split(/\s+/).filter(Boolean) : [v]);
    for (let item of list) {
      item = String(item);
      if (/[\r\n\0]/.test(item)) throw new Error(`${p.name} contains a line break`);
      if (item.startsWith('-') && p.type !== 'secret') throw new Error(`${p.name} cannot start with a dash`);
      argv.push(p.suffix ? item + p.suffix : item);
    }
  });
  if (cmd.suffix) argv.push(...cmd.suffix);
  return argv;
}

module.exports = { COMMANDS, GROUPS, GLOBAL_FLAGS, PREF_FLAGS, findCommand, buildArgs, pick };
