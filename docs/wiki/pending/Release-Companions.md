# Portable companions

## Behaviour

Every release publishes two programs that run from a single unsigned `.exe`, with nothing to
install:

- **MaterialTailscaleBuildCompanion**: a window with **Build**, **Build and run** and **Build
  installer**, which run the repository's own `build.bat`, `build.bat --run` and
  `build-installer.bat`. It carries the complete source of the commit it was made from
  (`git archive` of that commit, with a note of the commit and file count), unpacks it once into
  your local app data and builds there, so no checkout is needed. "Use a folder instead" builds a
  checkout you choose. The log streams live, progress follows the scripts' `[1/3]` steps, Stop
  ends the whole process tree, and Copy log puts the log on the clipboard.
- **MaterialTailscaleOfflineWebsite**: the whole website (landing, Features, every article,
  changelog and download notes) served from inside the program, so it works with no internet.
  Links to other sites open in your browser.

## Configuration

None. Both follow the system's dark or light setting; the website keeps its own language,
appearance and accessibility settings.

## When something goes wrong

- The build companion's buttons are off outside Windows, because the scripts are Windows batch
  files.
- A failed build shows its exit code; the log says why. Missing tools are fetched by
  `download-dependencies.bat`, and Windows asks for permission when a step needs it.

## Security and privacy

Both are unsigned; each release checks that they report NotSigned. Neither sends anything
anywhere. The build companion only runs the two batch files from the source it carries or the
folder you chose.

## How to verify

`npm run companions` builds both into `out/companions/`. `NODE_PATH=$(npm root -g) xvfb-run -a
node scripts/capture-companions.mjs` photographs both windows from the same files. On Windows,
run each `.exe` from a release.

## 廣東話摘要

每次發佈都有兩個免安裝程式：建置助手自帶嗰個 commit 嘅完整程式碼，一撳就建置；
離線網站將成個網站連所有文章裝晒入去，冇網都睇得。兩個都冇簽署。

## Suggested articles

- [Building from source](Release-Build-From-Source)
- [Release pipeline](Release-Release-Pipeline)
