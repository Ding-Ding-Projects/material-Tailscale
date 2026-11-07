# Virtual disks

## Behaviour

Tools > Virtual disks (Windows) manages VHD, VHDX and VHD Set files and ISO images in three
sections.

- **Library**: the disk files you add or create, with their format, size, size on disk and state
  (attached with its drive letters, or detached). Attach, Detach, and More: Grow (raises the
  maximum while detached and can extend the last partition), Shrink a VHDX to the smallest size
  that cuts no partition, Compact a dynamic disk (attached read-only while it runs), Convert into
  a new VHD or VHDX file (the original stays), Merge a differencing disk into its parent,
  Details, Attach read-only, Show in folder, and Remove from the library (the file stays).
- **Create a disk**: format (VHDX or VHD), type (dynamic, fixed or differencing with a parent you
  choose), size with presets, and where to save it. Optionally partition (GPT or MBR), format
  (NTFS, exFAT, FAT32 or ReFS) with a label, and attach. The card "What will run" shows the exact
  DiskPart and PowerShell steps before anything happens.
- **Quick pack**: drop files and folders (or choose them). The app works out a dynamic VHDX big
  enough for them (the files, a 4 KB cluster per file, file-system room and 10% to spare), names
  it after the first item and puts it beside them, adding (2), (3) and so on if the name is taken.
  It creates and formats the disk, copies everything, reads every copy back and compares its
  SHA-256 with the original, and detaches the disk. A mismatch stops the pack and keeps the disk
  attached so you can look.

The page shows which routes this PC has: DiskPart, the Storage module and the virtual disk API
are on every edition, Windows Home included; the Hyper-V module is not on Home and the page does
not need it.

## Configuration

None beyond each form. The library list is kept with the app's settings.

## When something goes wrong

- Every change asks Windows for permission. Cancelling the prompt changes nothing and says so.
- A failed step names itself and gives the reason; "Copy a help request" puts the details on the
  clipboard.
- Grow, Shrink, Merge and Convert need the disk detached and say so.
- On computers that do not run Windows the page explains every action but its buttons are off.

## Security and privacy

Paths are checked before anything runs (absolute, a virtual disk extension, nothing overwritten).
The disk script never deletes a disk file and never replaces one. It runs elevated only for the
operation you asked for, with a request file the app writes and a result file it reads back.

## How to verify

`test/vdisk.test.mjs` checks the request rules, Quick pack's sizing and naming, that the script
guards every create and convert against overwriting, that it only ever removes its own temporary
file, and that every change is elevated. Each release also runs `scripts/vdisk-proof.ps1` on a
clean Windows runner: it creates, formats, writes to, detaches, grows, shrinks, compacts, converts,
makes a differencing disk, merges it, attaches an ISO it made, and runs Quick pack twice in a
folder whose name has spaces and Chinese letters, then adds every result to the release notes.

Not built yet: creating VHD Sets and their checkpoints, custom metadata, mirroring, change
tracking and identity reset. On Windows Home only the virtual disk API offers them.

## 廣東話摘要

虛擬磁碟（Windows）：建立、掛載、擴大、縮細、壓縮、轉換、合併 VHD 同 VHDX，掛載 ISO。
快速打包會將拖入嚟嘅檔案整成一個啱啱好大細嘅 VHDX，逐個檔案核對 SHA-256，絕對唔會覆蓋。
改磁碟之前 Windows 一定會問你攞權限。

## Suggested articles

- [File converter](file-converter.md)
- [Building from source](../release/build-from-source.md)
