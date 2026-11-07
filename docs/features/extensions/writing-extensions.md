# Writing extensions

## Behaviour

An extension is a folder with a `manifest.json` and a program. The program can be written in any language. For each action the app:

1. starts the program in the extension's folder;
2. writes one JSON request to its standard input and closes it;
3. reads one JSON answer from its standard output;
4. checks the answer and then shows a message, copies text, opens a link or lists checks.

This is version 1 of the extension protocol. The app refuses a manifest that asks for another version.

### Folder

```
extensions/
  my-extension/          <- the folder name must equal the id
    manifest.json
    main.js              <- or main.py, main.ps1, a compiled program, ...
```

The extensions folder is inside the app's data folder; the manager's **Open extensions folder** button opens it. You can also keep your extension anywhere and use **Add from folder…**, which copies it in. An extension folder can hold at most 2,000 files and 20 MB, and it cannot contain links to other places.

### manifest.json

| Field | Required | What it holds |
| --- | --- | --- |
| `manifestVersion` | yes | `1` |
| `id` | yes | 2 to 63 lowercase letters, digits, dots or hyphens, starting with a letter or digit; equal to the folder name |
| `name` | yes | Text of up to 60 characters, or `{ "en": "...", "yue": "..." }` for English and Cantonese |
| `version` | yes | Like `1.0.0`. A new version needs the user's permission again |
| `apiVersion` | yes | `1` |
| `description` | yes | Up to 300 characters, plain or `{ "en", "yue" }` |
| `author` | no | Up to 80 characters |
| `homepage` | no | An https link |
| `run` | yes | Exactly one of `{ "script": "main.js" }` (a `.js`, `.mjs` or `.cjs` file run by the app's own JavaScript runtime, so nothing else needs installing) or `{ "command": ["program", "argument", ...] }` (1 to 16 strings: any program on the PATH or a path inside the folder, then its arguments; it starts in the extension's folder) |
| `permissions` | yes | A list without repeats of the permissions below |
| `actions` | yes | 1 to 12 actions |

Each action has `id` (lowercase letters, digits or hyphens, unique in the extension), `hook` (where it appears), `title` (up to 60 characters, plain or `{ "en", "yue" }`), and optionally `icon` (a [Material Symbols](https://fonts.google.com/icons) name such as `terminal`) and `description`. Any other field in the manifest or an action is refused, so a typo is caught instead of ignored.

### Hooks

| Hook | Where it appears | Needs |
| --- | --- | --- |
| `peer.action` | The menu of every device on the Peers page | `peer-details` |
| `status.check` | The Checks from extensions card in Diagnostics | `tailnet-status` |

### Permissions

| Permission | What it allows |
| --- | --- |
| `peer-details` | The request for a device action carries that one device: `name`, `dnsName`, `addresses`, `os`, `online`, `tags`, `lastSeen`, `offersExitNode`, `isExitNode` |
| `tailnet-status` | The request for a check carries a summary: `version`, `state`, `magicDnsSuffix`, `self` (`name`, `dnsName`, `addresses`, `os`, `online`, `keyExpiry`), `exitNode` (`name`, `dnsName`) or `null`, `devices` (`total`, `online`) and `health` (warning texts) |
| `clipboard` | The answer may include `copy`: text the app puts on the clipboard |
| `open-url` | The answer may include `openUrl`: an http or https link the app opens in the browser |

Nothing else is ever sent: no keys of any kind, Admin API tokens, e-mail addresses or login names, public addresses of other devices, passwords, authenticator secrets or vault contents.

### Request

```json
{
  "protocol": "material-tailscale.extension",
  "apiVersion": 1,
  "hook": "peer.action",
  "action": "copy",
  "language": "en",
  "peer": {
    "name": "nas",
    "dnsName": "nas.tail1234.ts.net",
    "addresses": ["100.64.0.7", "fd7a:115c:a1e0::7"],
    "os": "linux",
    "online": true,
    "tags": ["tag:storage"],
    "lastSeen": "2026-11-06T10:00:00Z",
    "offersExitNode": true,
    "isExitNode": false
  }
}
```

`language` is the user's language mode: `en`, `yue` (Cantonese) or `both`. A `status.check` request carries `status` instead of `peer`.

### Answer

```json
{ "ok": true, "message": "Copied \"tailscale ssh nas.tail1234.ts.net\".", "copy": "tailscale ssh nas.tail1234.ts.net" }
```

| Field | Rules |
| --- | --- |
| `ok` | Required, `true` or `false`. With `false`, put the reason in `message` |
| `message` | Optional, up to 500 characters, shown to the user with the extension's name |
| `copy` | Needs `clipboard`; 1 to 4,000 characters |
| `openUrl` | Needs `open-url`; an http or https link of up to 2,000 characters, without a user name or password |
| `checks` | Only for `status.check`; up to 20 items, each `{ "title": "...", "state": "ok", "detail": "..." }` where `state` is `ok`, `warn` or `fail` (title up to 120 characters, detail up to 500 and optional) |

Any other field is refused. Write nothing else to standard output; use standard error for logs (its first line is shown when the program fails).

### Limits

- The program must answer within **5 seconds**; after that it is stopped.
- The answer can be at most **64 KiB**.
- The exit code must be 0. Anything else is a failure, reported with the first line of standard error.
- The program starts with a small environment: the program search path, the temporary folder and the home folder, plus `MT_EXTENSION_API=1`. Your other environment variables, including any tokens in them, are not passed on.

## Configuration

### A worked example

An extension that copies a `ping` command for a device, in JavaScript run by the app's own runtime:

1. Make a folder named `ping-command` in the extensions folder.
2. Add `manifest.json`:

   ```json
   {
     "manifestVersion": 1,
     "id": "ping-command",
     "name": "Ping command",
     "version": "1.0.0",
     "apiVersion": 1,
     "description": "Copies a tailscale ping command for a device.",
     "run": { "script": "main.js" },
     "permissions": ["peer-details", "clipboard"],
     "actions": [{ "id": "copy", "hook": "peer.action", "title": "Copy ping command", "icon": "network_ping" }]
   }
   ```

3. Add `main.js`:

   ```js
   let input = '';
   process.stdin.on('data', (d) => { input += d; });
   process.stdin.on('end', () => {
     const { peer } = JSON.parse(input);
     const command = `tailscale ping ${peer.dnsName || peer.addresses[0]}`;
     process.stdout.write(JSON.stringify({ ok: true, copy: command, message: `Copied "${command}".` }));
   });
   ```

4. In the manager choose **Reload**, review Ping command and choose **Allow and turn on**.
5. Open Peers, open a device's menu and choose **Copy ping command**.

To try a program by hand, pipe a request into it: `echo '{"hook":"peer.action","action":"copy","peer":{"dnsName":"nas.tail1234.ts.net","addresses":["100.64.0.7"]}}' | node main.js`.

### Samples in the repository

`extensions/samples` in the source repository holds three runnable samples, one per runtime:

- `hello-python`: Python 3, a device action that greets the device (`"run": { "command": ["python", "main.py"] }`).
- `addresses-powershell`: Windows PowerShell 5.1, which every Windows 10 and 11 computer has, a device action that copies all of a device's addresses.
- `online-share-node`: JavaScript on the app's own runtime, a Diagnostics check that warns when fewer than half of the devices are online.

The four built-in extensions in `extensions/builtin` are complete examples as well.

## When something goes wrong

- **Manifest problems** in the manager list each problem: fix them and choose **Reload**.
- **It could not start**: the program is not installed or not on the PATH. On Windows, `python` may be `py`; use the full path or the launcher your system has.
- **Its answer was not valid JSON**: something else was written to standard output, such as a debug print. Send logs to standard error.
- **It did not answer within 5 seconds**: do slow work elsewhere, or answer first and finish in the background.
- **Its answer asked to copy text, but it does not have the clipboard permission**: add the permission to the manifest; the user is asked again.

## Security and privacy

Users see exactly what your extension asks for before it can run, and again whenever its version, permissions or program change. Ask only for the permissions you use. Your extension runs as the user, so it can read their files and use the network: do so only for what the user asked, and say what you do in the description.

## How to verify

`test/extensions.test.mjs` runs the built-in extensions and the samples through the real host, including the Python sample when Python is installed. For your own extension, pipe a request into it as shown above, then add it with the manager and run it from a device menu or Diagnostics.

## 廣東話摘要

擴充功能就係一個有 manifest.json 同程式嘅資料夾，程式可以用任何語言寫：標準輸入收一個 JSON 請求，標準輸出答一個 JSON。五秒內要答，答覆最多 64 KiB；權限、欄位同長度全部有規定，多咗或者越權都會被拒絕。

## Suggested articles

- [Extensions](extensions.md)
- [Peers and live status](../tailscale/peers.md)
- [Diagnostics](../tailscale/diagnostics.md)
