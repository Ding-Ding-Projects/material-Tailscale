# Minecraft servers

## Behaviour

Create, adopt and run Minecraft servers from one page (Tools > Minecraft servers).

The page header counts your servers and how many are running, from each server's real status; a target that does not answer within a few seconds is counted as not answering rather than guessed. With no servers yet, the page shows a first-run card with the three steps (choose an edition, flavour and version; choose where it runs; read and accept the EULA yourself and start) and the New server and Discover and adopt buttons. With servers, the first one opens automatically.

- **New server wizard**: four steps. Pick Java Edition (Vanilla, Paper, Purpur, Folia, Fabric, Forge) or Bedrock Edition; pick any version from the official catalogue with channel filters (releases, snapshots, pre-releases, beta, alpha, previews) and a regex search; pick where it runs (this computer, Docker on this computer, an SSH host, or Docker on an SSH host) and check the target; then set the name, port and memory. Catalogues show when they were retrieved and fall back to the last copy when offline, labelled as such.
- **Downloads are verified**: the exact build is resolved from the publisher (Mojang SHA-1, PaperMC Fill v3 SHA-256, Purpur MD5, Forge SHA-1, Modrinth SHA-512). A download without a published checksum is labelled as unverified rather than called verified. The Java runtime the version needs is fetched from Adoptium with its checksum.
- **Discover and adopt** looks for existing server folders and containers on a target. Nothing is taken over until you choose Adopt for one item.
- **Overview**: state, memory and CPU, start, stop, restart and force stop (force stop needs the two-key confirmation), distribution details and the EULA card. The Minecraft EULA is only ever accepted by you, with the button on the card.
- **Console**: live log with export, quick actions, and a command builder generated from the version's own command tree, with a typed control for each argument (numbers, booleans, coordinates, game modes, time with units, selectors and more).
- **Configuration**: every key in `server.properties` as a typed control (switches, choices, steppers, decimals, secrets), with help text, defaults, whether a restart is needed, and a warning when a key does not apply to the server's version. Unknown keys are kept exactly as written. Saving keeps a `.bak` copy and records the change in local history with secrets hidden.
- **Players**: operators (with permission level), allowlist, banned players and banned IPs for Java; allowlist and permissions for Bedrock. Java names are checked against Mojang before they are added.
- **Plugins or mods**: search Modrinth for releases compatible with the server's version and loader, install with SHA-512 verification and licence shown, enable, disable or remove (removed files move to `.removed`).
- **Worlds**: back up now (saving is paused for the backup and resumed after), list and restore backups (a safety backup is made first), import a world archive, export a world as ZIP.
- **World generator** (Java): pickers extracted from the exact server jar (world presets, biomes, structure sets, superflat presets, noise settings, blocks and game rules). Choose the seed (or random), preset, superflat layers, single biome or noise settings, difficulty, game mode, hardcore, structures, world border and typed game rules. The area is set on a chunk canvas (default 100 by 100 chunks) by dragging, resizing or with the keyboard, with an estimate of batches, time and size. Output to a folder or a ZIP, never overwriting, verified file by file; generation can be cancelled between batches.
- **Schedule**: restart, backup or command at a time on chosen days, in your local time zone, while the app is open. Missed runs are skipped, never run late.

## When something goes wrong

Every failure shows the publisher's message and a "Copy a help request" button. A lost SSH connection shows "Host unreachable" and says the server may still be running. Bedrock has no machine-readable generator, so the generator tab says so.

## Security and privacy

SSH uses your system `ssh` with key authentication only; passwords are never stored. The RCON password is a secret field and is hidden in history. Nothing runs through a shell.

## How to verify

Create a server with the wizard, accept the EULA on its card, start it and watch the console; change a setting and restart; install a plugin and check its file in the server folder.

## 廣東話摘要

喺本機、Docker 或者 SSH 建立同管理 Minecraft 伺服器：版本、插件、設定、玩家、備份、排程同世界生成器。

## Suggested articles

- [Command palette (Ctrl+Shift+F)](Navigation-Command-Palette)
- [Settings that explain themselves](Navigation-Settings-Explanations)
