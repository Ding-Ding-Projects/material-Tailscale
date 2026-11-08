# Virtual disks

## Behaviour

Tools > Virtual disks (Windows) manages VHD, VHDX and VHD Set files and ISO images in four
sections.

- **Library**: the disk files you add or create, with their format, size, size on disk and state
  (attached with its drive letters, or detached). Attach, Detach, and More: Grow (raises the
  maximum while detached and can extend the last partition), Shrink a VHDX (either its last
  partition first, as far as Windows says it safely can, which is the check Disk Management makes
  before Shrink Volume, and then the disk; or the disk alone, to the smallest size that cuts no
  partition), Compact a dynamic disk (attached read-only while it runs), Convert into
  a new VHD or VHDX file (the original stays), Merge a differencing disk into its parent,
  Details, Attach read-only, Show in folder, and Remove from the library (the file stays).
- **Create a disk**: format (VHDX, VHD or VHD Set), type (dynamic, fixed, or differencing with a
  parent you choose; a VHD Set is dynamic or fixed), size with presets, and where to save it. Optionally partition (GPT or MBR), format
  (NTFS, exFAT, FAT32 or ReFS) with a label, and attach. The card "What will run" shows the exact
  virtual disk API and PowerShell steps before anything happens. A VHD Set is created through the
  virtual disk API as well, with its first data file beside it, on every edition of Windows.
- **Quick pack**: drop files and folders (or choose them). The app works out a dynamic VHDX big
  enough for them (the files, a 4 KB cluster per file, file-system room and 10% to spare), names
  it after the first item and puts it beside them, adding (2), (3) and so on if the name is taken.
  It creates and formats the disk, copies everything, reads every copy back and compares its
  SHA-256 with the original, and detaches the disk. A mismatch stops the pack and keeps the disk
  attached so you can look.
- **Advanced** (also *Advanced* in a disk's More menu): pick a disk, read its details, then:
  - **Identity**: the disk identifier and the virtual disk ID, each with *New…*. Differencing
    disks find their parent by its identifier, so a new identifier takes the two-key confirmation.
  - **Change tracking** (VHDX): turn it on or off, see the most recent change-tracking point and
    whether anything changed since, and list the blocks changed since any point you paste.
  - **Custom metadata** (VHDX): every item with its ID, size and value (text, or the first bytes
    in hex); add a text item or delete one.
  - **Checkpoints** (VHD Set): take one, return to one (the current state is kept as a new
    checkpoint unless you switch that off and pass the two-key confirmation), or delete one. With
    the Hyper-V module the list comes from `Get-VHDSnapshot`; without it the app remembers the
    checkpoints it took.
  - **Live mirror** (VHD or VHDX): copies the disk into a new file while it stays in use; when
    the copy is complete an attached disk carries on from the new file and the original keeps the
    state it had at that moment.

The page shows which routes this PC has: the virtual disk API and the Storage module are on every
edition, Windows Home included, and every operation uses them. The Hyper-V module is not on Home;
where it is installed, the app uses it for one thing only, listing every checkpoint of a VHD Set,
including ones taken elsewhere.

## Configuration

None beyond each form. The library list is kept with the app's settings.

## When something goes wrong

- Every change asks Windows for permission. Cancelling the prompt changes nothing and says so.
- A failed step names itself and gives the reason; "Copy a help request" puts the details on the
  clipboard.
- Grow, Shrink, Merge, Convert, new identifiers, metadata changes and returning to or deleting a
  checkpoint need the disk detached and say so.
- Shrinking the disk alone while a partition reaches its end is refused with that reason and
  changes nothing; choose to shrink the last partition first.
- Result codes from the virtual disk API are reported in words with their number, including the
  ones above 0x7FFFFFFF that PowerShell cannot convert to a 32-bit integer.
- A mirror stops with the reason if the copy fails; the new file is left for you to inspect.
- On computers that do not run Windows the page explains every action but its buttons are off.

## Security and privacy

Paths are checked before anything runs (absolute, a virtual disk extension, nothing overwritten).
IDs must be well-formed GUIDs, change-tracking points must look like one, and metadata text is
limited to 32,768 characters.
The disk script never deletes a disk file and never replaces one. It runs elevated only for the
operation you asked for, with a request file the app writes and a result file it reads back.

## How to verify

`test/vdisk.test.mjs` checks the request rules, Quick pack's sizing and naming, that the script
guards every create and convert against overwriting, that it only ever removes its own temporary
file, and that every change is elevated. Each release also runs `scripts/vdisk-proof.ps1` on a
clean Windows runner: it creates, formats, writes to, detaches and grows a disk, checks that the
disk alone refuses to shrink while its partition reaches the end, shrinks the last partition and
then the disk, reads the earlier file back, and then compacts, converts,
makes a differencing disk, merges it, attaches an ISO it made, runs Quick pack twice in a folder
whose name has spaces and Chinese letters, renews both identifiers, writes, reads and deletes a
metadata item, turns change tracking on, writes 256 KB and lists the changed blocks, mirrors the
disk into a new file, creates a dynamic VHD Set through the virtual disk API, takes a checkpoint,
returns to it and deletes it, creates a fixed VHD Set and partitions, formats and writes into it,
then adds every result to the release notes.

What the probes on a hosted Windows Server 2025 runner found:

- The virtual disk API renews identifiers, edits metadata, tracks changes, mirrors, and takes,
  returns to and deletes checkpoints without Hyper-V.
- Creating a VHD Set was refused with "The parameter is incorrect" until the request carried
  `CREATE_VIRTUAL_DISK_FLAG_CREATE_BACKING_STORAGE`. With that flag, versions 2, 3 and 4 of the
  request all created the set and its first data file, nothing was written past the documented
  structure, and each set took a checkpoint, attached and detached. A process that had made the
  refused calls crashed later with Windows reporting corrupted memory; the runs with the flag,
  each in its own process, ended cleanly.
- DiskPart reads its script in the console code page, so a folder with Chinese letters broke every
  DiskPart step. Nothing here uses DiskPart any more.
- A refused shrink came back with a code above 0x7FFFFFFF, which PowerShell could not convert, so
  the error itself failed. The script now puts every code into words itself.

## 廣東話摘要

虛擬磁碟（Windows）：建立、掛載、擴大、縮細、壓縮、轉換、合併 VHD 同 VHDX，建立同掛載 VHD Set，掛載 ISO。
縮細可以先縮最後一個分割區（Windows 話安全縮到幾多就幾多），再縮磁碟。
進階分頁可以換識別碼、改 VHDX 自訂元資料、開關變更追蹤、管理 VHD Set 檢查點，仲有即時鏡像。
全部功能 Windows Home 都得，連建立 VHD Set 都係；有 Hyper-V 模組嘅話仲可以列出喺第度影嘅檢查點。
快速打包會將拖入嚟嘅檔案整成一個啱啱好大細嘅 VHDX，逐個檔案核對 SHA-256，絕對唔會覆蓋。
改磁碟之前 Windows 一定會問你攞權限。

## Suggested articles

- [File converter](Tools-File-Converter)
- [Building from source](Release-Build-From-Source)
