# Extensions

## Behaviour

Extensions are small programs, written in any language, that add things to Material Tailscale:

- **Actions on a device**: they appear in the menu of every device on the Peers page (the more button or a right-click on a card or table row). The built-in ones copy a Tailscale SSH command, copy a Markdown summary of the device, or open the device's own web page.
- **Checks in Diagnostics**: they appear in the **Checks from extensions** card on the Diagnostics page; **Run checks** runs them all and lists each result as fine, needs a look, or problem, with a short explanation. The built-in Tailnet health extension checks the connection, this device's key expiry, the exit node in use, how many devices are online, health warnings and the Tailscale version.

Open the manager from Tools > Extensions, from the command palette (search "extensions"), from the New tab catalogue, or with the Extensions button on the Diagnostics card. It shows every installed extension with:

- its name, id, version, and whether it is built in or modified;
- its state: on, off, waiting for your permission, changed (it needs your review again), or manifest problems;
- what it adds (each action and where it appears) and what it may see or do (each permission in plain words);
- its three most recent runs, with the time, how long it took, and the reason when one failed;
- for a broken manifest, the exact problems to fix in `manifest.json`.

The manager also has a search field with the full regex builder, **Add from folder…**, **Open extensions folder**, **Reload**, and the **Extensions can run** switch, which stops every extension at once and keeps their permissions. Each extension's menu has **Show in folder**, **Review permissions** and **Remove**.

### Permission before anything runs

A new extension, and any extension whose version, permissions or program change, stays off until you open its review and choose **Allow and turn on**. The review lists exactly what it asks for, which of those are new since you last allowed it, what it adds, and what it never receives. **Keep off** is the default button. After that you can switch it off and on without being asked again until it changes.

### Built-in extensions

Four extensions come with the app: SSH command, Device summary, Web page and Tailnet health. They are written in JavaScript and run on the app's own runtime, so they need nothing else installed. They are marked **Built in**, they wait for your permission like any other extension, and you can switch them off or remove them. An update to the app updates a built-in extension only while you have not changed its files; a modified copy is marked **Modified** and left alone, and a removed one stays removed.

## Configuration

- Extensions live in the `extensions` folder inside the app's data folder (Settings > Data > Open app data folder), one folder per extension, named by its id. **Open extensions folder** opens it.
- **Add from folder…** copies a folder that holds a `manifest.json` into the extensions folder. If a different version with the same id is installed, the app asks before replacing it, and the new version waits for your permission.
- Your permissions and the recent runs are kept in `extensions-state.json` next to the extensions folder.
- How to write an extension: [Writing extensions](writing-extensions.md).

## When something goes wrong

- **Waiting for your permission** or **Changed: review again**: open the review and allow it, or keep it off.
- **Manifest problems**: the card lists each problem in plain words, such as an unknown field, an id that does not match its folder, or an action that needs a permission the manifest does not ask for. Fix `manifest.json`, then choose **Reload**.
- **Did not finish**: the message says why. An extension that does not answer within five seconds is stopped. An answer larger than 64 KiB, an answer that is not JSON, an exit code other than 0 (with the first line the program wrote to its error output), and an answer that asks for something the extension has no permission for (for example copying text without the clipboard permission) are all refused and shown as failures in its recent runs.
- **It could not start**: the program in the manifest is not installed or not on your PATH, for example Python for the Python sample.

## Security and privacy

- An extension receives only the fields its permissions name, chosen by the app from an allow-list: never node, machine, disco or auth keys, Admin API tokens, account e-mail addresses or login names, the public network addresses of other devices, passwords, authenticator secrets or anything in the system vault.
- It starts with a small, clean environment (the program search path, the temporary folder and the home folder), so tokens in your environment variables are not passed on.
- The app checks every answer before acting on it: links must be http or https without a user name or password, text to copy and messages have length limits, and unknown fields are refused.
- What the app cannot enforce: an extension is a program that runs as you, so nothing stops it from reading your files or using the network on its own. The manager and the review say so. Add only extensions you trust, and read their code when you can.

## How to verify

1. Open Tools > Extensions: the four built-in extensions are listed and wait for your permission.
2. Review SSH command and allow it. Open Peers, open a device's menu: **Copy SSH command** is there; choosing it copies `tailscale ssh <device>.<tailnet>.ts.net`.
3. Allow Tailnet health, open Diagnostics and choose **Run checks**: the results appear with their states.
4. Switch **Extensions can run** off: the device menu no longer shows extension actions.
5. The automated tests (`test/extensions.test.mjs`) cover manifest checks and refusals, consent for new and changed extensions, permissions on requests and answers, the five-second limit, the answer size limit, the clean environment, built-in updates, replacing a version, and real runs of the built-in extensions and the samples.

## 廣東話摘要

擴充功能係用任何語言寫嘅小程式，可以為每部裝置加動作、為診斷加檢查。新嘅或者改過嘅擴充功能要你批准先會開；佢只會收到權限講明嘅資料，永遠收唔到金鑰、權杖、電郵或者保險箱入面嘅嘢。程式會停咗超過五秒嘅擴充功能，亦會拒絕太大或者越權嘅答覆。

## Suggested articles

- [Writing extensions](writing-extensions.md)
- [Peers and live status](../tailscale/peers.md)
- [Diagnostics](../tailscale/diagnostics.md)
