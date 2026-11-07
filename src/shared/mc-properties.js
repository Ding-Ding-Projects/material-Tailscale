'use strict';
// Typed descriptors for server.properties. Each entry binds a key to its type,
// default, bounds or choices, unit, whether a restart is needed, and the
// version boundary where it applies. Keys found in a real file but missing
// here are preserved and shown as "no descriptor yet" text controls, never
// dropped. Sources: the vanilla server's generated defaults and the Microsoft
// Bedrock dedicated server documentation.
const b = (key, def, help, extra = {}) => ({ key, type: 'bool', def, help, restart: true, ...extra });
const i = (key, def, min, max, help, extra = {}) => ({ key, type: 'int', def, min, max, help, restart: true, ...extra });
const e = (key, def, choices, help, extra = {}) => ({ key, type: 'enum', def, choices, help, restart: true, ...extra });
const f = (key, def, min, max, help, extra = {}) => ({ key, type: 'float', def, min, max, help, restart: true, ...extra });
const s = (key, def, help, extra = {}) => ({ key, type: 'text', def, help, restart: true, ...extra });

const JAVA = [
  e('difficulty', 'easy', ['peaceful', 'easy', 'normal', 'hard'], 'How hard the world is.', { restart: false, live: 'difficulty <value>' }),
  e('gamemode', 'survival', ['survival', 'creative', 'adventure', 'spectator'], 'Default game mode for new players.'),
  b('force-gamemode', false, 'Put players back into the default game mode when they join.'),
  b('hardcore', false, 'Hardcore mode: one life, then spectator.'),
  b('pvp', true, 'Players can damage each other.', { until: '1.21.8', note: 'Moved to the pvp game rule in 1.21.9.' }),
  i('max-players', 20, 0, 2147483647, 'Most players online at once.', { unit: 'players' }),
  b('online-mode', true, 'Check every player against Mojang accounts. Turn off only behind a proxy that authenticates.'),
  b('white-list', false, 'Only players on the allowlist can join.', { note: 'Defaults to true from 26.3.' }),
  b('enforce-whitelist', false, 'Kick players who are not on the allowlist when it is reloaded.'),
  i('server-port', 25565, 1, 65535, 'TCP port players connect to.', { unit: 'port' }),
  s('server-ip', '', 'Bind to one local address. Empty listens on all.'),
  s('motd', 'A Minecraft Server', 'Message shown in the server list.'),
  i('view-distance', 10, 3, 32, 'Chunks sent around each player.', { unit: 'chunks' }),
  i('simulation-distance', 10, 3, 32, 'Chunks around each player that tick.', { unit: 'chunks', since: '1.18' }),
  i('spawn-protection', 16, 0, 2147483647, 'Radius around spawn that only operators can build in.', { unit: 'blocks' }),
  b('allow-flight', false, 'Allow flying in survival (for mods). Otherwise players are kicked for flying.'),
  b('allow-nether', true, 'Allow travel to the Nether.', { until: '1.21.8' }),
  b('spawn-monsters', true, 'Monsters spawn.', { until: '1.21.8' }),
  b('spawn-animals', true, 'Animals spawn.', { until: '1.21.2' }),
  b('spawn-npcs', true, 'Villagers spawn.', { until: '1.21.2' }),
  b('generate-structures', true, 'Generate villages, temples and other structures.'),
  s('level-name', 'world', 'World folder name.'),
  s('level-seed', '', 'World seed. Empty picks a random one.'),
  s('level-type', 'minecraft\\:normal', 'World preset id, for example minecraft:normal or minecraft:flat.'),
  s('generator-settings', '{}', 'JSON settings for the chosen world type.'),
  i('max-world-size', 29999984, 1, 29999984, 'Maximum world border radius.', { unit: 'blocks' }),
  i('max-tick-time', 60000, -1, 2147483647, 'Stop the server if a tick takes longer than this. -1 disables.', { unit: 'ms' }),
  i('network-compression-threshold', 256, -1, 2147483647, 'Compress packets larger than this. -1 disables.', { unit: 'bytes' }),
  i('op-permission-level', 4, 1, 4, 'Permission level given by /op.'),
  i('function-permission-level', 2, 1, 4, 'Permission level for data pack functions.'),
  i('player-idle-timeout', 0, 0, 2147483647, 'Kick idle players after this many minutes. 0 never.', { unit: 'minutes' }),
  i('rate-limit', 0, 0, 2147483647, 'Kick players sending more packets per second than this. 0 disables.', { unit: 'packets/s' }),
  i('entity-broadcast-range-percentage', 100, 10, 1000, 'How far away entities are sent to players.', { unit: '%' }),
  b('enable-command-block', false, 'Allow command blocks.'),
  b('enable-rcon', false, 'Remote console over TCP. Use a strong password.'),
  i('rcon.port', 25575, 1, 65535, 'Remote console port.', { unit: 'port' }),
  s('rcon.password', '', 'Remote console password.', { secret: true }),
  b('broadcast-rcon-to-ops', true, 'Show remote console commands to operators.'),
  b('enable-query', false, 'GameSpy4 query protocol for server lists.'),
  i('query.port', 25565, 1, 65535, 'Query port.', { unit: 'port' }),
  b('broadcast-console-to-ops', true, 'Show console commands to operators.'),
  b('enable-status', true, 'Show the server as online in the server list.'),
  b('hide-online-players', false, 'Hide the player list in the server list.'),
  b('enable-jmx-monitoring', false, 'Expose JMX monitoring beans.'),
  b('sync-chunk-writes', true, 'Write chunks synchronously (safer, slower).'),
  e('region-file-compression', 'deflate', ['deflate', 'lz4', 'none'], 'Compression used for region files.', { since: '1.20.5' }),
  b('enforce-secure-profile', true, 'Require signed chat profiles.', { since: '1.19' }),
  b('prevent-proxy-connections', false, 'Kick players whose address differs from the one Mojang saw.'),
  b('use-native-transport', true, 'Use the Linux native network transport when available.'),
  b('log-ips', true, 'Write player IP addresses to the log.', { since: '1.20.2' }),
  b('accepts-transfers', false, 'Accept players transferred from another server.', { since: '1.20.5' }),
  i('max-chained-neighbor-updates', 1000000, -1, 2147483647, 'Limit chained block updates.', { since: '1.19' }),
  s('resource-pack', '', 'URL of a server resource pack.'),
  s('resource-pack-sha1', '', 'SHA-1 of the resource pack.'),
  s('resource-pack-id', '', 'UUID of the resource pack.', { since: '1.20.3' }),
  b('require-resource-pack', false, 'Kick players who decline the resource pack.'),
  s('resource-pack-prompt', '', 'JSON text shown when asking for the resource pack.'),
  s('initial-enabled-packs', 'vanilla', 'Data packs enabled when the world is created.'),
  s('initial-disabled-packs', '', 'Data packs disabled when the world is created.'),
  s('text-filtering-config', '', 'Chat text filtering configuration.'),
  i('text-filtering-version', 0, 0, 1, 'Text filtering format version.', { since: '1.21.2' }),
  i('pause-when-empty-seconds', 60, -1, 2147483647, 'Pause ticking after this many seconds with nobody online.', { unit: 's', since: '1.21.2' }),
  s('bug-report-link', '', 'Link shown on the report-a-bug screen.', { since: '1.21' }),
  b('management-server-enabled', false, 'JSON-RPC management over WebSocket.', { since: '1.21.9' }),
  s('management-server-host', 'localhost', 'Management server bind address.', { since: '1.21.9' }),
  i('management-server-port', 0, 0, 65535, 'Management server port. 0 picks one.', { since: '1.21.9' }),
  b('management-server-tls-enabled', true, 'Use TLS for the management server; needs a keystore.', { since: '1.21.9' }),
  s('management-server-secret', '', 'Secret for management clients.', { since: '1.21.9', secret: true }),
  i('status-heartbeat-interval', 0, 0, 2147483647, 'Seconds between management heartbeats. 0 disables.', { since: '1.21.9' })
];

const BEDROCK = [
  s('server-name', 'Dedicated Server', 'Server name shown in the list.'),
  e('gamemode', 'survival', ['survival', 'creative', 'adventure'], 'Default game mode.'),
  b('force-gamemode', false, 'Force the default game mode on joining players.'),
  e('difficulty', 'easy', ['peaceful', 'easy', 'normal', 'hard'], 'World difficulty.'),
  b('allow-cheats', false, 'Allow commands that count as cheats.'),
  i('max-players', 10, 1, 1000, 'Most players at once.'),
  b('online-mode', true, 'Require Xbox Live authentication.'),
  b('allow-list', false, 'Only allow players on the allowlist.'),
  i('server-port', 19132, 1, 65535, 'IPv4 UDP port.', { unit: 'port' }),
  i('server-portv6', 19133, 1, 65535, 'IPv6 UDP port.', { unit: 'port' }),
  b('enable-lan-visibility', true, 'Announce on the local network.'),
  i('view-distance', 32, 5, 96, 'Chunks visible to players.', { unit: 'chunks' }),
  i('tick-distance', 4, 4, 12, 'Chunks that tick around players.', { unit: 'chunks' }),
  i('player-idle-timeout', 30, 0, 2147483647, 'Kick idle players after this many minutes. 0 never.', { unit: 'minutes' }),
  i('max-threads', 8, 0, 256, 'Worker threads. 0 uses as many as possible.'),
  s('level-name', 'Bedrock level', 'World folder name.'),
  s('level-seed', '', 'World seed.'),
  e('default-player-permission-level', 'member', ['visitor', 'member', 'operator'], 'Permission level for new players.'),
  b('texturepack-required', false, 'Force clients to use the world\'s texture packs.'),
  b('content-log-file-enabled', false, 'Write content errors to a file.'),
  i('compression-threshold', 1, 0, 65535, 'Smallest payload to compress.', { unit: 'bytes' }),
  e('compression-algorithm', 'zlib', ['zlib', 'snappy'], 'Network compression algorithm.'),
  e('server-authoritative-movement', 'server-auth', ['client-auth', 'server-auth', 'server-auth-with-rewind'], 'Who decides player movement.'),
  i('player-movement-score-threshold', 20, 0, 2147483647, 'Movement differences before reporting.'),
  f('player-movement-action-direction-threshold', 0.85, 0, 1, 'Attack direction tolerance.'),
  f('player-movement-distance-threshold', 0.3, 0, 10, 'Distance difference tolerance.'),
  i('player-movement-duration-threshold-in-ms', 500, 0, 60000, 'Time a difference may last.', { unit: 'ms' }),
  b('correct-player-movement', false, 'Snap players back when movement is wrong.'),
  b('server-authoritative-block-breaking', false, 'Server checks block breaking.'),
  e('chat-restriction', 'None', ['None', 'Dropped', 'Disabled'], 'Chat restrictions.'),
  b('disable-player-interaction', false, 'Players cannot interact with each other.'),
  b('client-side-chunk-generation-enabled', true, 'Let clients generate visual chunks.'),
  b('block-network-ids-are-hashes', true, 'Use hashed block network ids.'),
  b('disable-persona', false, 'Disable persona skins.'),
  b('disable-custom-skins', false, 'Disable custom skins.'),
  e('server-build-radius-ratio', 'Disabled', ['Disabled'], 'Share of chunk generation done by the server.'),
  b('allow-outbound-script-debugging', false, 'Allow script debugger connections out.'),
  b('allow-inbound-script-debugging', false, 'Allow script debugger connections in.'),
  e('script-debugger-auto-attach', 'disabled', ['disabled', 'connect', 'listen'], 'Attach the script debugger automatically.'),
  b('emit-server-telemetry', false, 'Send server telemetry.')
];

function describe(edition, key) { return (edition === 'bedrock' ? BEDROCK : JAVA).find((d) => d.key === key) || null; }

/** Compares dotted versions; returns null for snapshots it cannot order. */
function cmp(a, b2) { const pa = String(a).split('.').map(Number), pb = String(b2).split('.').map(Number); if ([...pa, ...pb].some(Number.isNaN)) return null; for (let k = 0; k < Math.max(pa.length, pb.length); k++) { const d = (pa[k] || 0) - (pb[k] || 0); if (d) return d; } return 0; }
function applies(desc, version) {
  if (!desc) return { ok: true };
  if (desc.since && cmp(version, desc.since) !== null && cmp(version, desc.since) < 0) return { ok: false, reason: `Added in ${desc.since}.` };
  if (desc.until && cmp(version, desc.until) !== null && cmp(version, desc.until) > 0) return { ok: false, reason: desc.note || `Removed after ${desc.until}.` };
  return { ok: true };
}

module.exports = { JAVA, BEDROCK, describe, applies, cmp };
