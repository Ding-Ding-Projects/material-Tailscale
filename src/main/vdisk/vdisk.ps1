# Virtual disk operations for Material Tailscale, through routes every Windows edition has: the
# VirtDisk API (virtdisk.dll) to create, grow, shrink, compact, convert, merge and describe a disk,
# and for identity, custom metadata, change tracking, VHD Set checkpoints and live mirroring; and
# the Storage module for attach, detach, ISO images, partitioning and formatting. DiskPart is not
# used: it reads its script in the console code page, so a path with letters outside that page
# (Chinese, for one) reached it as a command it did not know. A VHD Set is created through the
# VirtDisk API too, with CREATE_VIRTUAL_DISK_FLAG_CREATE_BACKING_STORAGE; without that flag Windows
# answers "The parameter is incorrect" (both verified on a hosted Windows Server 2025 runner).
# Only listing a VHD Set's checkpoints uses the Hyper-V module, where it is installed. The app runs this script
# elevated, after Windows asks for permission, with a JSON request file; it writes a JSON result
# file and appends progress lines to a progress file. Never overwrites a file and never deletes one.
param(
  [Parameter(Mandatory = $true)] [string]$Request,
  [Parameter(Mandatory = $true)] [string]$Result,
  [string]$Progress = ''
)
$ErrorActionPreference = 'Stop'
$steps = New-Object System.Collections.Generic.List[object]
$data = [ordered]@{}

function Note([string]$msg, $extra) {
  if (-not $Progress) { return }
  $o = [ordered]@{ at = (Get-Date).ToString('o'); msg = $msg }
  if ($extra) { foreach ($k in $extra.Keys) { $o[$k] = $extra[$k] } }
  Add-Content -LiteralPath $Progress -Value ($o | ConvertTo-Json -Compress) -Encoding UTF8
}
function Step([string]$name, [scriptblock]$body) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  Note "start" @{ step = $name }
  try {
    $detail = & $body
    $steps.Add([ordered]@{ name = $name; ok = $true; ms = $sw.ElapsedMilliseconds; detail = [string]($detail -join ' ') })
    Note "done" @{ step = $name }
    return $detail
  } catch {
    $steps.Add([ordered]@{ name = $name; ok = $false; ms = $sw.ElapsedMilliseconds; detail = $_.Exception.Message })
    Note "fail" @{ step = $name; error = $_.Exception.Message }
    throw
  }
}
function NeedNew([string]$p) { if (Test-Path -LiteralPath $p) { throw "A file already exists at $p, and nothing is ever overwritten." } }
function NeedFile([string]$p) { if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { throw "There is no file at $p." } }
function Image([string]$p) { Get-DiskImage -ImagePath $p }
function NeedDetached([string]$p) { if ((Image $p).Attached) { throw "Detach the disk first: $p is attached." } }
function Letters([string]$p) {
  $img = Image $p
  if (-not $img.Attached) { return @() }
  if ($img.StorageType -eq 1) { return @(($img | Get-Volume -ErrorAction SilentlyContinue).DriveLetter | Where-Object { $_ }) }
  return @(($img | Get-Disk | Get-Partition -ErrorAction SilentlyContinue).DriveLetter | Where-Object { $_ -and $_ -ne [char]0 })
}
function Attach([string]$p, [bool]$readOnly, [bool]$noLetter) {
  $args2 = @{ ImagePath = $p; PassThru = $true }
  if ($p -match '\.iso$') { $args2.StorageType = 'ISO' } else { $args2.Access = $(if ($readOnly) { 'ReadOnly' } else { 'ReadWrite' }) }
  if ($noLetter) { $args2.NoDriveLetter = $true }
  Mount-DiskImage @args2 | Out-Null
  return (Letters $p)
}
function Prepare([string]$p, [string]$style, [string]$fs, [string]$label) {
  $disk = Image $p | Get-Disk
  Initialize-Disk -Number $disk.Number -PartitionStyle $style -ErrorAction Stop
  $part = New-Partition -DiskNumber $disk.Number -UseMaximumSize -AssignDriveLetter
  Format-Volume -Partition $part -FileSystem $fs -NewFileSystemLabel $label -Confirm:$false -Force | Out-Null
  return "$fs on $($part.DriveLetter):"
}
function Info([string]$p) {
  $item = Get-Item -LiteralPath $p
  $o = [ordered]@{ path = $p; exists = $true; fileSize = $item.Length; format = $item.Extension.TrimStart('.').ToUpper() }
  try {
    $img = Image $p
    $o.attached = [bool]$img.Attached; $o.virtualSize = [int64]$img.Size; $o.letters = @(Letters $p)
    $o.storageType = @{ 1 = 'ISO'; 2 = 'VHD'; 3 = 'VHDX'; 4 = 'VHDSet' }[[int]$img.StorageType]
  } catch { $o.error = $_.Exception.Message }
  return $o
}

# The VirtDisk API. Every block below is laid out exactly as virtdisk.h declares it for 64-bit
# Windows.
$virtDisk = @'
using System; using System.Runtime.InteropServices; using System.Threading; using System.Collections.Generic;
public static class MtVirtDisk {
  static readonly Guid MS = new Guid("EC984AEC-A0F9-47e9-901F-71415A66345B");
  [StructLayout(LayoutKind.Sequential)] public struct STORAGE_TYPE { public uint DeviceId; public Guid VendorId; }
  [StructLayout(LayoutKind.Sequential)] public struct OPEN_V2 { public uint Version; public int GetInfoOnly; public int ReadOnly; public Guid ResiliencyGuid; }
  [StructLayout(LayoutKind.Explicit)] public struct RESIZE_V1 { [FieldOffset(0)] public uint Version; [FieldOffset(8)] public ulong NewSize; }
  [StructLayout(LayoutKind.Explicit, Size = 32)] public struct SET_INFO { [FieldOffset(0)] public uint Version; [FieldOffset(8)] public Guid Id; [FieldOffset(8)] public int Enabled; }
  [StructLayout(LayoutKind.Sequential)] public struct SNAP_ONE { public uint Version; public Guid SnapshotId; }
  [StructLayout(LayoutKind.Sequential)] public struct SNAP_APPLY { public uint Version; public Guid SnapshotId; public Guid LeafSnapshotId; }
  [StructLayout(LayoutKind.Sequential)] public struct PROGRESS { public uint OperationStatus; public ulong CurrentValue; public ulong CompletionValue; }
  [StructLayout(LayoutKind.Sequential)] public struct RANGE { public ulong ByteOffset; public ulong ByteLength; public ulong Reserved; }
  [DllImport("virtdisk.dll", CharSet = CharSet.Unicode)] static extern uint OpenVirtualDisk(ref STORAGE_TYPE t, string path, uint access, uint flags, ref OPEN_V2 p, out IntPtr h);
  [DllImport("virtdisk.dll")] static extern uint ResizeVirtualDisk(IntPtr h, uint flags, ref RESIZE_V1 p, IntPtr overlapped);
  [DllImport("virtdisk.dll")] static extern uint GetVirtualDiskInformation(IntPtr h, ref uint size, IntPtr info, out uint used);
  [DllImport("virtdisk.dll")] static extern uint SetVirtualDiskInformation(IntPtr h, ref SET_INFO p);
  [DllImport("virtdisk.dll")] static extern uint EnumerateVirtualDiskMetadata(IntPtr h, ref uint count, [Out] Guid[] items);
  [DllImport("virtdisk.dll")] static extern uint GetVirtualDiskMetadata(IntPtr h, ref Guid item, ref uint size, [Out] byte[] buffer);
  [DllImport("virtdisk.dll")] static extern uint SetVirtualDiskMetadata(IntPtr h, ref Guid item, uint size, byte[] buffer);
  [DllImport("virtdisk.dll")] static extern uint DeleteVirtualDiskMetadata(IntPtr h, ref Guid item);
  [DllImport("virtdisk.dll", CharSet = CharSet.Unicode)] static extern uint QueryChangesVirtualDisk(IntPtr h, string changeTrackingId, ulong offset, ulong length, uint flags, [Out] RANGE[] ranges, ref uint count, out ulong processed);
  [DllImport("virtdisk.dll")] static extern uint TakeSnapshotVhdSet(IntPtr h, ref SNAP_ONE p, uint flags);
  [DllImport("virtdisk.dll")] static extern uint ApplySnapshotVhdSet(IntPtr h, ref SNAP_APPLY p, uint flags);
  [DllImport("virtdisk.dll")] static extern uint DeleteSnapshotVhdSet(IntPtr h, ref SNAP_ONE p, uint flags);
  [DllImport("virtdisk.dll")] static extern uint MirrorVirtualDisk(IntPtr h, uint flags, IntPtr p, IntPtr overlapped);
  [DllImport("virtdisk.dll")] static extern uint BreakMirrorVirtualDisk(IntPtr h);
  [DllImport("virtdisk.dll")] static extern uint GetVirtualDiskOperationProgress(IntPtr h, IntPtr overlapped, out PROGRESS p);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll")] static extern IntPtr CreateEvent(IntPtr a, bool manual, bool initial, IntPtr name);

  [StructLayout(LayoutKind.Explicit, Size = 128)] public struct CREATE_V2 {
    [FieldOffset(0)] public uint Version; [FieldOffset(8)] public Guid UniqueId; [FieldOffset(24)] public ulong MaximumSize;
    [FieldOffset(32)] public uint BlockSizeInBytes; [FieldOffset(36)] public uint SectorSizeInBytes; [FieldOffset(40)] public uint PhysicalSectorSizeInBytes;
    [FieldOffset(48)] public IntPtr ParentPath; [FieldOffset(56)] public IntPtr SourcePath; [FieldOffset(64)] public uint OpenFlags;
    [FieldOffset(68)] public uint ParentDeviceId; [FieldOffset(72)] public Guid ParentVendorId;
    [FieldOffset(88)] public uint SourceDeviceId; [FieldOffset(92)] public Guid SourceVendorId; [FieldOffset(108)] public Guid ResiliencyGuid; }
  [StructLayout(LayoutKind.Explicit)] public struct EXPAND_V1 { [FieldOffset(0)] public uint Version; [FieldOffset(8)] public ulong NewSize; }
  [StructLayout(LayoutKind.Sequential)] public struct COMPACT_V1 { public uint Version; public uint Reserved; }
  [StructLayout(LayoutKind.Sequential)] public struct MERGE_V2 { public uint Version; public uint MergeSourceDepth; public uint MergeTargetDepth; }
  [DllImport("virtdisk.dll", CharSet = CharSet.Unicode)] static extern uint CreateVirtualDisk(ref STORAGE_TYPE t, string path, uint access, IntPtr sd, uint flags, uint providerFlags, ref CREATE_V2 p, IntPtr overlapped, out IntPtr h);
  [DllImport("virtdisk.dll")] static extern uint ExpandVirtualDisk(IntPtr h, uint flags, ref EXPAND_V1 p, IntPtr overlapped);
  [DllImport("virtdisk.dll")] static extern uint CompactVirtualDisk(IntPtr h, uint flags, ref COMPACT_V1 p, IntPtr overlapped);
  [DllImport("virtdisk.dll")] static extern uint MergeVirtualDisk(IntPtr h, uint flags, ref MERGE_V2 p, IntPtr overlapped);

  static STORAGE_TYPE TypeOf(string path) {
    string e = System.IO.Path.GetExtension(path).ToLowerInvariant();
    return new STORAGE_TYPE { DeviceId = e == ".vhdx" ? 3u : e == ".vhd" ? 2u : e == ".vhds" ? 4u : 0u, VendorId = MS };
  }
  /// Creates a VHD, VHDX or VHD Set: dynamic, fixed (every byte allocated now), a differencing
  /// child of parent, or a new disk filled from source (a conversion). A VHD Set needs
  /// CREATE_VIRTUAL_DISK_FLAG_CREATE_BACKING_STORAGE (0x8), which also makes its first data file
  /// beside it; without the flag Windows refuses with "The parameter is incorrect".
  public static void Create(string path, ulong size, bool fixedSize, string parent, string source) {
    var t = TypeOf(path);
    if (t.DeviceId == 0) throw new ArgumentException("A virtual disk ends in .vhd, .vhdx or .vhds.");
    if (string.IsNullOrEmpty(parent)) parent = null; if (string.IsNullOrEmpty(source)) source = null;
    bool set = t.DeviceId == 4u;
    if (set && (parent != null || source != null)) throw new ArgumentException("A VHD Set is created empty, dynamic or fixed.");
    uint flags = (fixedSize ? 1u : 0u) | (set ? 8u : 0u);
    IntPtr pp = parent == null ? IntPtr.Zero : Marshal.StringToHGlobalUni(parent), sp = source == null ? IntPtr.Zero : Marshal.StringToHGlobalUni(source);
    try {
      var p = new CREATE_V2 { Version = 2, MaximumSize = parent != null || source != null ? 0 : size, ParentPath = pp, SourcePath = sp };
      IntPtr h; Check(CreateVirtualDisk(ref t, path, 0, IntPtr.Zero, flags, 0, ref p, IntPtr.Zero, out h), set ? "Create the VHD Set" : "Create the disk");
      CloseHandle(h);
    } finally { if (pp != IntPtr.Zero) Marshal.FreeHGlobal(pp); if (sp != IntPtr.Zero) Marshal.FreeHGlobal(sp); }
  }
  /// Raises the maximum size: ResizeVirtualDisk for VHDX, ExpandVirtualDisk for VHD.
  public static void Grow(string path, ulong newSize) {
    IntPtr h = Open(path);
    try {
      if (path.EndsWith(".vhdx", StringComparison.OrdinalIgnoreCase)) { var r = new RESIZE_V1 { Version = 1, NewSize = newSize }; Check(ResizeVirtualDisk(h, 0, ref r, IntPtr.Zero), "Grow the disk"); }
      else { var e = new EXPAND_V1 { Version = 1, NewSize = newSize }; Check(ExpandVirtualDisk(h, 0, ref e, IntPtr.Zero), "Grow the disk"); }
    } finally { CloseHandle(h); }
  }
  public static void Compact(string path) { IntPtr h = Open(path); try { var c = new COMPACT_V1 { Version = 1 }; Check(CompactVirtualDisk(h, 0, ref c, IntPtr.Zero), "Compact the disk"); } finally { CloseHandle(h); } }
  /// Folds the child into its parents, depth levels up.
  public static void Merge(string path, uint depth) { IntPtr h = Open(path); try { var m = new MERGE_V2 { Version = 2, MergeSourceDepth = 1, MergeTargetDepth = depth + 1 }; Check(MergeVirtualDisk(h, 0, ref m, IntPtr.Zero), "Merge into the parent"); } finally { CloseHandle(h); } }
  /// A readable summary: format, kind, sizes, sector sizes, identifier and parent.
  public static string Detail(string path) {
    IntPtr h = Open(path);
    try {
      var sb = new System.Text.StringBuilder();
      IntPtr b = Info(h, 1);
      try { sb.AppendLine("Virtual size:   " + (ulong)Marshal.ReadInt64(b, 8) + " bytes"); sb.AppendLine("Size on disk:   " + (ulong)Marshal.ReadInt64(b, 16) + " bytes"); sb.AppendLine("Block size:     " + (uint)Marshal.ReadInt32(b, 24) + " bytes"); sb.AppendLine("Sector size:    " + (uint)Marshal.ReadInt32(b, 28) + " bytes"); } finally { Marshal.FreeHGlobal(b); }
      b = Info(h, 6); try { uint d = (uint)Marshal.ReadInt32(b, 8); sb.AppendLine("Format:         " + (d == 2 ? "VHD" : d == 3 ? "VHDX" : d == 4 ? "VHD Set" : d == 1 ? "ISO" : "unknown (" + d + ")")); } finally { Marshal.FreeHGlobal(b); }
      uint kind = 0; b = Info(h, 7); try { kind = (uint)Marshal.ReadInt32(b, 8); sb.AppendLine("Kind:           " + (kind == 2 ? "Fixed" : kind == 3 ? "Dynamic" : kind == 4 ? "Differencing" : "unknown (" + kind + ")")); } finally { Marshal.FreeHGlobal(b); }
      sb.AppendLine("Identifier:     " + Id(h, 2));
      if (kind == 4) { b = Info(h, 3); try { sb.AppendLine("Parent:         " + Marshal.PtrToStringUni(b + 12) + (Marshal.ReadInt32(b, 8) != 0 ? "" : " (not found)")); } finally { Marshal.FreeHGlobal(b); } }
      return sb.ToString();
    } finally { CloseHandle(h); }
  }
  /// Plain words for a result code. The virtual disk codes start at 0xC03A0000 and do not fit an
  /// Int32, so PowerShell cannot hand them to Win32Exception itself.
  public static string Say(uint r) {
    switch (r) {
      case 0xC03A0025u: return "That size would cut into a partition, so nothing was changed";
      case 0xC03A0026u: return "Windows could not work out the smallest safe size of this disk";
      case 0xC03A0027u: return "The disk is already as small as it can safely be: a partition reaches its end";
      default: return new System.ComponentModel.Win32Exception(unchecked((int)r)).Message.TrimEnd('.', ' ');
    }
  }
  public static string Code(uint r) { return r > 0xFFFFu ? "0x" + r.ToString("X8") : r.ToString(); }
  public static bool AtSmallest(uint r) { return r == 0xC03A0027u; }
  static void Check(uint r, string what) { if (r != 0) throw new Exception(what + ": " + Say(r) + " (code " + Code(r) + ")."); }
  /// Opens a disk with version 2 parameters (no access mask), which every call below accepts.
  public static IntPtr Open(string path) {
    bool set = path.EndsWith(".vhds", StringComparison.OrdinalIgnoreCase);
    var t = new STORAGE_TYPE { DeviceId = set ? 4u : 0u, VendorId = set ? MS : Guid.Empty };
    var o = new OPEN_V2 { Version = 2 };
    IntPtr h; Check(OpenVirtualDisk(ref t, path, 0, 0, ref o, out h), "Open the disk");
    return h;
  }
  // Shrinks to the smallest size that cuts no partition (RESIZE_TO_SMALLEST_SAFE_VIRTUAL_SIZE),
  // or to newSize when that is still safe. Returns the Win32 error code, 0 on success.
  public static uint Shrink(string path, ulong newSize) {
    var t = new STORAGE_TYPE { DeviceId = 0, VendorId = Guid.Empty };
    var o = new OPEN_V2 { Version = 2 };
    IntPtr h; uint r = OpenVirtualDisk(ref t, path, 0, 0, ref o, out h);
    if (r != 0) return r;
    try { var p = new RESIZE_V1 { Version = 1, NewSize = newSize }; return ResizeVirtualDisk(h, newSize == 0 ? 2u : 0u, ref p, IntPtr.Zero); }
    finally { CloseHandle(h); }
  }
  static IntPtr Info(IntPtr h, uint version) {
    uint size = 4096; IntPtr b = Marshal.AllocHGlobal(4096);
    for (int i = 0; i < 4096; i++) Marshal.WriteByte(b, i, 0);
    Marshal.WriteInt32(b, (int)version);
    uint used; uint r = GetVirtualDiskInformation(h, ref size, b, out used);
    if (r != 0) { Marshal.FreeHGlobal(b); Check(r, "Read the disk information"); }
    return b;
  }
  /// version 2: the disk identifier; version 14: the virtual disk ID.
  public static string Id(IntPtr h, uint version) { IntPtr b = Info(h, version); try { byte[] g = new byte[16]; Marshal.Copy(b + 8, g, 0, 16); return new Guid(g).ToString(); } finally { Marshal.FreeHGlobal(b); } }
  public static ulong VirtualSize(IntPtr h) { IntPtr b = Info(h, 1); try { return (ulong)Marshal.ReadInt64(b, 8); } finally { Marshal.FreeHGlobal(b); } }
  /// enabled, newer changes since the most recent point, the most recent point.
  public static string[] Rct(IntPtr h) { IntPtr b = Info(h, 15); try { return new[] { (Marshal.ReadInt32(b, 8) != 0).ToString(), (Marshal.ReadInt32(b, 12) != 0).ToString(), Marshal.PtrToStringUni(b + 16) }; } finally { Marshal.FreeHGlobal(b); } }
  /// version 2 sets the disk identifier, version 5 the virtual disk ID. Returns the new value.
  public static string NewId(IntPtr h, uint version) { var s = new SET_INFO { Version = version, Id = Guid.NewGuid() }; Check(SetVirtualDiskInformation(h, ref s), "Set the identifier"); return s.Id.ToString(); }
  public static void SetRct(IntPtr h, bool on) { var s = new SET_INFO { Version = 6, Enabled = on ? 1 : 0 }; Check(SetVirtualDiskInformation(h, ref s), on ? "Turn change tracking on" : "Turn change tracking off"); }
  public static Guid[] MetaItems(IntPtr h) {
    uint n = 1024; var items = new Guid[n]; uint r = EnumerateVirtualDiskMetadata(h, ref n, items);
    if (r == 122 || r == 234) { items = new Guid[n]; r = EnumerateVirtualDiskMetadata(h, ref n, items); }
    Check(r, "List the metadata");
    var list = new Guid[n]; Array.Copy(items, list, (int)n); return list;
  }
  public static byte[] MetaGet(IntPtr h, Guid item) {
    uint size = 65536; var buf = new byte[size]; uint r = GetVirtualDiskMetadata(h, ref item, ref size, buf);
    if (r == 122 || r == 234) { buf = new byte[size]; r = GetVirtualDiskMetadata(h, ref item, ref size, buf); }
    Check(r, "Read a metadata item");
    var data = new byte[size]; Array.Copy(buf, data, (int)size); return data;
  }
  public static void MetaSet(IntPtr h, Guid item, byte[] data) { Check(SetVirtualDiskMetadata(h, ref item, (uint)data.Length, data), "Write the metadata item"); }
  public static void MetaDelete(IntPtr h, Guid item) { Check(DeleteVirtualDiskMetadata(h, ref item), "Delete the metadata item"); }
  /// Changed byte ranges since a change-tracking point, over the whole disk: count, bytes, first ranges.
  public static string[] Changes(IntPtr h, string since, ulong total) {
    ulong offset = 0, bytes = 0, count = 0; var first = new List<string>();
    var ranges = new RANGE[256];
    while (offset < total) {
      uint n = 256; ulong processed;
      Check(QueryChangesVirtualDisk(h, since, offset, total - offset, 0, ranges, ref n, out processed), "Query the changes");
      for (int i = 0; i < n; i++) { count++; bytes += ranges[i].ByteLength; if (first.Count < 20) first.Add(ranges[i].ByteOffset + "+" + ranges[i].ByteLength); }
      if (processed == 0) break;
      offset += processed;
    }
    return new[] { count.ToString(), bytes.ToString(), string.Join(",", first.ToArray()) };
  }
  public static string Take(IntPtr h) { var p = new SNAP_ONE { Version = 1, SnapshotId = Guid.NewGuid() }; Check(TakeSnapshotVhdSet(h, ref p, 0), "Take the checkpoint"); return p.SnapshotId.ToString(); }
  /// Returns to a checkpoint. With keep, the current state becomes a new checkpoint (its ID is returned).
  public static string Apply(IntPtr h, Guid id, bool keep) { var p = new SNAP_APPLY { Version = 1, SnapshotId = id, LeafSnapshotId = keep ? Guid.NewGuid() : Guid.Empty }; Check(ApplySnapshotVhdSet(h, ref p, 0), "Return to the checkpoint"); return keep ? p.LeafSnapshotId.ToString() : ""; }
  public static void Delete(IntPtr h, Guid id) { var p = new SNAP_ONE { Version = 1, SnapshotId = id }; Check(DeleteSnapshotVhdSet(h, ref p, 0), "Delete the checkpoint"); }
  /// Starts a live mirror. The returned memory (OVERLAPPED, parameters, path) must stay alive
  /// until MirrorFree, because the copy keeps using it after this call returns.
  public static IntPtr[] MirrorStart(IntPtr h, string dest) {
    IntPtr ov = Marshal.AllocHGlobal(64), prm = Marshal.AllocHGlobal(16), path = Marshal.StringToHGlobalUni(dest);
    for (int i = 0; i < 64; i++) Marshal.WriteByte(ov, i, 0);
    for (int i = 0; i < 16; i++) Marshal.WriteByte(prm, i, 0);
    Marshal.WriteIntPtr(ov, IntPtr.Size == 8 ? 24 : 16, CreateEvent(IntPtr.Zero, true, false, IntPtr.Zero));
    Marshal.WriteInt32(prm, 0, 1); Marshal.WriteIntPtr(prm, 8, path);
    uint r = MirrorVirtualDisk(h, 0, prm, ov);
    if (r != 0 && r != 997) { MirrorFree(new[] { ov, prm, path }); Check(r, "Start the mirror"); }
    return new[] { ov, prm, path };
  }
  /// status (997 while running), bytes copied, bytes to copy.
  public static ulong[] MirrorPoll(IntPtr h, IntPtr ov) { PROGRESS p; Check(GetVirtualDiskOperationProgress(h, ov, out p), "Read the mirror progress"); return new[] { (ulong)p.OperationStatus, p.CurrentValue, p.CompletionValue }; }
  public static void MirrorBreak(IntPtr h) { Check(BreakMirrorVirtualDisk(h), "Switch to the mirror"); }
  public static void MirrorFree(IntPtr[] mem) {
    IntPtr ev = Marshal.ReadIntPtr(mem[0], IntPtr.Size == 8 ? 24 : 16); if (ev != IntPtr.Zero) CloseHandle(ev);
    foreach (var m in mem) Marshal.FreeHGlobal(m);
  }
}
'@

# Identity, custom metadata, change tracking and checkpoints of one disk. Each part is read on its
# own, so a part a format does not have (a VHD has no metadata) is reported instead of failing all.
function UseVirtDisk { if (-not ('MtVirtDisk' -as [type])) { Add-Type -TypeDefinition $virtDisk } }
function Text([byte[]]$b) {
  if ($b.Length -gt 0 -and $b.Length % 2 -eq 0) { $t = [Text.Encoding]::Unicode.GetString($b); if ($t -notmatch '[\x00-\x08\x0E-\x1F]') { return $t } }
  return $null
}
function Advanced([string]$p) {
  UseVirtDisk
  $o = [ordered]@{ path = $p; format = [IO.Path]::GetExtension($p).TrimStart('.').ToUpper() }
  $h = [MtVirtDisk]::Open($p)
  try {
    try { $o.identifier = [MtVirtDisk]::Id($h, 2); $o.virtualDiskId = [MtVirtDisk]::Id($h, 14) } catch { $o.identityError = $_.Exception.Message }
    try { $o.virtualSize = [MtVirtDisk]::VirtualSize($h) } catch { }
    if ($o.format -eq 'VHDX') {
      try {
        $o.metadata = @(foreach ($g in [MtVirtDisk]::MetaItems($h)) {
          $b = [MtVirtDisk]::MetaGet($h, $g)
          [ordered]@{ id = $g.ToString(); size = $b.Length; text = (Text $b); hex = (($b | Select-Object -First 48 | ForEach-Object { $_.ToString('x2') }) -join '') }
        })
      } catch { $o.metadataError = $_.Exception.Message }
      try { $r = [MtVirtDisk]::Rct($h); $o.rct = [ordered]@{ enabled = ($r[0] -eq 'True'); newer = ($r[1] -eq 'True'); id = $r[2] } } catch { $o.rctError = $_.Exception.Message }
    }
  } finally { [void][MtVirtDisk]::CloseHandle($h) }
  if ($o.format -eq 'VHDS') {
    $snap = Get-Command Get-VHDSnapshot -ErrorAction SilentlyContinue
    $o.checkpointsListed = [bool]$snap
    if ($snap) { try { $o.checkpoints = @(Get-VHDSnapshot -Path $p | ForEach-Object { [ordered]@{ id = $_.SnapshotId.ToString(); at = $_.CreationTime.ToString('o') } }) } catch { $o.checkpointsError = $_.Exception.Message } }
  }
  return $o
}
function WithDisk([string]$p, [scriptblock]$body) { UseVirtDisk; $h = [MtVirtDisk]::Open($p); try { & $body $h } finally { [void][MtVirtDisk]::CloseHandle($h) } }

try {
  $req = Get-Content -LiteralPath $Request -Raw -Encoding UTF8 | ConvertFrom-Json
  $data.op = $req.op
  switch ($req.op) {
    'probe' {
      $os = Get-CimInstance Win32_OperatingSystem
      $data.edition = $os.Caption
      $data.build = $os.BuildNumber
      $data.storage = [bool](Get-Command Mount-DiskImage -ErrorAction SilentlyContinue)
      $data.virtdisk = Test-Path -LiteralPath "$env:SystemRoot\System32\virtdisk.dll"
      $data.hyperv = [bool](Get-Command Get-VHDSnapshot -ErrorAction SilentlyContinue)
      $data.elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    }
    'info' { $data.disks = @($req.paths | ForEach-Object { if (Test-Path -LiteralPath $_ -PathType Leaf) { Info $_ } else { [ordered]@{ path = $_; exists = $false } } }) }
    'create' {
      NeedNew $req.path
      if ($req.path -match '\.vhds$') {
        UseVirtDisk
        Step 'Create the VHD Set and its first data file' { [MtVirtDisk]::Create($req.path, [uint64]([int64]$req.sizeMB * 1MB), ($req.type -eq 'fixed'), '', ''); "$($req.sizeMB) MB $($req.type) VHD Set" } | Out-Null
      } elseif ($req.type -eq 'differencing') {
        NeedFile $req.parent; UseVirtDisk
        Step 'Create the disk' { [MtVirtDisk]::Create($req.path, 0, $false, [string]$req.parent, ''); 'differencing' } | Out-Null
      } else {
        UseVirtDisk
        Step 'Create the disk' { [MtVirtDisk]::Create($req.path, [uint64]([int64]$req.sizeMB * 1MB), ($req.type -eq 'fixed'), '', ''); "$($req.sizeMB) MB $($req.type)" } | Out-Null
      }
      if ($req.prepare -or $req.attach) { Step 'Attach' { Attach $req.path $false (-not $req.attach -and -not $req.prepare) } | Out-Null }
      if ($req.prepare) { Step 'Partition and format' { Prepare $req.path $req.prepare.style $req.prepare.fs $req.prepare.label } | Out-Null }
      if ($req.prepare -and -not $req.attach) { Step 'Detach' { Dismount-DiskImage -ImagePath $req.path | Out-Null } | Out-Null }
      $data.disk = Info $req.path
    }
    'attach' { NeedFile $req.path; $data.letters = @(Step 'Attach' { Attach $req.path ([bool]$req.readOnly) ([bool]$req.noLetter) }); $data.disk = Info $req.path }
    'detach' { NeedFile $req.path; Step 'Detach' { Dismount-DiskImage -ImagePath $req.path | Out-Null } | Out-Null; $data.disk = Info $req.path }
    'expand' {
      NeedFile $req.path; NeedDetached $req.path
      UseVirtDisk
      Step 'Grow the disk' { [MtVirtDisk]::Grow($req.path, [uint64]([int64]$req.sizeMB * 1MB)); "$($req.sizeMB) MB" } | Out-Null
      if ($req.extend) {
        Step 'Attach' { Attach $req.path $false $false } | Out-Null
        try {
          Step 'Extend the last partition' {
            $disk = Image $req.path | Get-Disk
            $part = Get-Partition -DiskNumber $disk.Number | Where-Object { $_.Type -ne 'Reserved' } | Sort-Object Offset | Select-Object -Last 1
            $max = (Get-PartitionSupportedSize -DiskNumber $disk.Number -PartitionNumber $part.PartitionNumber).SizeMax
            Resize-Partition -DiskNumber $disk.Number -PartitionNumber $part.PartitionNumber -Size $max
            "partition $($part.PartitionNumber) to $max bytes"
          } | Out-Null
        } finally { Step 'Detach' { Dismount-DiskImage -ImagePath $req.path | Out-Null } | Out-Null }
      }
      $data.disk = Info $req.path
    }
    'shrink' {
      NeedFile $req.path; NeedDetached $req.path
      if ($req.path -notmatch '\.vhdx$') { throw 'Only a VHDX file can be shrunk.' }
      UseVirtDisk
      if ($req.partition) {
        # Windows works out how small the last partition can get without moving anything it cannot
        # move (Get-PartitionSupportedSize), the same check Disk Management uses before Shrink Volume.
        # Files stay where they are; the disk then shrinks to the new end of that partition.
        Step 'Attach' { Attach $req.path $false $false } | Out-Null
        try {
          Step 'Shrink the last partition' {
            $disk = Image $req.path | Get-Disk
            $part = Get-Partition -DiskNumber $disk.Number | Where-Object { $_.Type -ne 'Reserved' } | Sort-Object Offset | Select-Object -Last 1
            if (-not $part) { throw 'The disk has no partition to shrink.' }
            $min = [uint64](Get-PartitionSupportedSize -DiskNumber $disk.Number -PartitionNumber $part.PartitionNumber).SizeMin
            $want = [uint64]([math]::Ceiling(($min + [uint64]$req.keepMB * 1MB) / 1MB) * 1MB)
            if ($want -ge [uint64]$part.Size) { "partition $($part.PartitionNumber) stays at $([math]::Round($part.Size / 1MB)) MB, already no larger than it needs to be" }
            else {
              Resize-Partition -DiskNumber $disk.Number -PartitionNumber $part.PartitionNumber -Size $want
              "partition $($part.PartitionNumber) from $([math]::Round($part.Size / 1MB)) MB to $([math]::Round($want / 1MB)) MB"
            }
          } | Out-Null
        } finally { Step 'Detach' { Dismount-DiskImage -ImagePath $req.path | Out-Null } | Out-Null }
      }
      Step 'Shrink the disk' {
        $before = WithDisk $req.path { param($h) [MtVirtDisk]::VirtualSize($h) }
        $code = [MtVirtDisk]::Shrink($req.path, [uint64]$(if ($req.sizeMB) { [int64]$req.sizeMB * 1MB } else { 0 }))
        if ($code -ne 0) {
          $hint = if ([MtVirtDisk]::AtSmallest($code) -and -not $req.partition) { ' Choose to shrink the last partition first to make room.' } else { '' }
          throw "Windows did not shrink the disk: $([MtVirtDisk]::Say($code)) (code $([MtVirtDisk]::Code($code))).$hint"
        }
        $after = WithDisk $req.path { param($h) [MtVirtDisk]::VirtualSize($h) }
        "from $([math]::Round($before / 1MB)) MB to $([math]::Round($after / 1MB)) MB"
      } | Out-Null
      $data.disk = Info $req.path
    }
    'compact' {
      NeedFile $req.path; NeedDetached $req.path
      Step 'Attach read-only' { Attach $req.path $true $true } | Out-Null
      UseVirtDisk
      try { Step 'Compact' { [MtVirtDisk]::Compact($req.path); 'compacted' } | Out-Null }
      finally { Step 'Detach' { Dismount-DiskImage -ImagePath $req.path | Out-Null } | Out-Null }
      $data.disk = Info $req.path
    }
    'convert' {
      NeedFile $req.path; NeedDetached $req.path; NeedNew $req.dest
      UseVirtDisk
      Step 'Copy into the new format' { [MtVirtDisk]::Create($req.dest, 0, ($req.type -eq 'fixed'), '', [string]$req.path); "$($req.dest)" } | Out-Null
      $data.disk = Info $req.dest
    }
    'merge' {
      NeedFile $req.path; NeedDetached $req.path
      UseVirtDisk
      Step 'Merge into the parent' { [MtVirtDisk]::Merge($req.path, [uint32]$req.depth); "depth $($req.depth)" } | Out-Null
    }
    'detail' {
      NeedFile $req.path
      if ($req.path -match '\.iso$') { $img = Image $req.path; $data.detail = "Format:         ISO`r`nSize:           $($img.Size) bytes`r`nAttached:       $($img.Attached)" }
      else { UseVirtDisk; $data.detail = (Step 'Read the details' { [MtVirtDisk]::Detail($req.path) }) }
    }
    'advanced' { NeedFile $req.path; $data.disk = Info $req.path; $data.advanced = (Step 'Read the details' { Advanced $req.path }) }
    'identity' {
      NeedFile $req.path; NeedDetached $req.path
      $v = @{ identifier = 2; virtualDiskId = 5 }[$req.which]
      $data.newValue = (Step 'Give the disk a new identifier' { WithDisk $req.path { param($h) [MtVirtDisk]::NewId($h, [uint32]$v) } })
      $data.advanced = Advanced $req.path
    }
    'meta-set' {
      NeedFile $req.path; NeedDetached $req.path
      $id = if ($req.item) { [Guid]$req.item } else { [Guid]::NewGuid() }
      Step 'Write the metadata item' { WithDisk $req.path { param($h) [MtVirtDisk]::MetaSet($h, $id, [Text.Encoding]::Unicode.GetBytes([string]$req.text)) }; $id.ToString() } | Out-Null
      $data.item = $id.ToString(); $data.advanced = Advanced $req.path
    }
    'meta-delete' {
      NeedFile $req.path; NeedDetached $req.path
      Step 'Delete the metadata item' { WithDisk $req.path { param($h) [MtVirtDisk]::MetaDelete($h, [Guid]$req.item) }; $req.item } | Out-Null
      $data.advanced = Advanced $req.path
    }
    'rct' {
      NeedFile $req.path
      Step $(if ($req.enabled) { 'Turn change tracking on' } else { 'Turn change tracking off' }) { WithDisk $req.path { param($h) [MtVirtDisk]::SetRct($h, [bool]$req.enabled) }; [string]$req.enabled } | Out-Null
      $data.advanced = Advanced $req.path
    }
    'rct-changes' {
      NeedFile $req.path
      $r = Step 'Find the changed blocks' { WithDisk $req.path { param($h) [MtVirtDisk]::Changes($h, [string]$req.since, [MtVirtDisk]::VirtualSize($h)) } }
      $data.changes = [ordered]@{ since = $req.since; ranges = [int64]$r[0]; bytes = [int64]$r[1]; first = @($r[2] -split ',' | Where-Object { $_ }) }
    }
    'checkpoint' {
      NeedFile $req.path
      if ($req.action -ne 'take') { NeedDetached $req.path }
      switch ($req.action) {
        'take' { $data.id = (Step 'Take a checkpoint' { WithDisk $req.path { param($h) [MtVirtDisk]::Take($h) } }) }
        'apply' { $data.kept = (Step 'Return to the checkpoint' { WithDisk $req.path { param($h) [MtVirtDisk]::Apply($h, [Guid]$req.id, [bool]$req.keep) } }) }
        'delete' { Step 'Delete the checkpoint' { WithDisk $req.path { param($h) [MtVirtDisk]::Delete($h, [Guid]$req.id) }; $req.id } | Out-Null }
      }
      $data.advanced = Advanced $req.path
    }
    'mirror' {
      NeedFile $req.path; NeedNew $req.dest
      UseVirtDisk
      $h = [MtVirtDisk]::Open($req.path)
      try {
        $mem = Step 'Start the mirror' { , [MtVirtDisk]::MirrorStart($h, [string]$req.dest) }
        try {
          Step 'Copy into the mirror' {
            while ($true) {
              $p = [MtVirtDisk]::MirrorPoll($h, $mem[0])
              Note 'mirror' @{ done = [int64]$p[1]; total = [int64]$p[2] }
              if ($p[0] -ne 997) { throw "The mirror stopped: $([MtVirtDisk]::Say([uint32]$p[0])) (code $([MtVirtDisk]::Code([uint32]$p[0])))." }
              if ($p[2] -gt 0 -and $p[1] -ge $p[2]) { break }
              Start-Sleep -Milliseconds 500
            }
            "$($p[1]) bytes"
          } | Out-Null
          Step 'Switch to the mirror' { [MtVirtDisk]::MirrorBreak($h); for ($i = 0; $i -lt 100; $i++) { $p = [MtVirtDisk]::MirrorPoll($h, $mem[0]); if ($p[0] -ne 997) { break }; Start-Sleep -Milliseconds 200 }; "status $($p[0])" } | Out-Null
        } finally { [MtVirtDisk]::MirrorFree($mem) }
      } finally { [void][MtVirtDisk]::CloseHandle($h) }
      $data.disk = Info $req.dest
    }
    'pack' {
      $items = @($req.items | ForEach-Object { Get-Item -LiteralPath $_ })
      if (-not $items.Count) { throw 'Nothing to pack.' }
      $files = @(foreach ($it in $items) { if ($it.PSIsContainer) { Get-ChildItem -LiteralPath $it.FullName -Recurse -File -Force | ForEach-Object { [pscustomobject]@{ Src = $_.FullName; Rel = Join-Path $it.Name $_.FullName.Substring($it.FullName.Length).TrimStart('\') ; Len = $_.Length } } } else { [pscustomobject]@{ Src = $it.FullName; Rel = $it.Name; Len = $it.Length } } })
      $bytes = [int64]($files | Measure-Object Len -Sum).Sum
      # Content, one 4 KB cluster of slack per file, file-system overhead and 10% to spare.
      $mb = [math]::Ceiling(($bytes + $files.Count * 4096 + [math]::Max(64MB, $bytes * 0.03)) * 1.10 / 1MB)
      $mb = [math]::Max($mb, 64)
      $dir = [IO.Path]::GetDirectoryName($items[0].FullName)
      $base = if ($items[0].PSIsContainer) { $items[0].Name } else { [IO.Path]::GetFileNameWithoutExtension($items[0].Name) }
      $dest = Join-Path $dir "$base.vhdx"; $n = 2
      while (Test-Path -LiteralPath $dest) { $dest = Join-Path $dir "$base ($n).vhdx"; $n++ }
      $data.dest = $dest; $data.files = $files.Count; $data.bytes = $bytes; $data.sizeMB = $mb
      Note 'plan' @{ dest = $dest; files = $files.Count; bytes = $bytes; sizeMB = $mb }
      UseVirtDisk
      Step 'Create the disk' { [MtVirtDisk]::Create($dest, [uint64]([int64]$mb * 1MB), $false, '', ''); "$mb MB" } | Out-Null
      Step 'Attach' { Attach $dest $false $false } | Out-Null
      $label = ($base -replace '[^A-Za-z0-9 _-]', '').Trim(); if (-not $label) { $label = 'Packed' }; if ($label.Length -gt 32) { $label = $label.Substring(0, 32) }
      Step 'Partition and format NTFS' { Prepare $dest 'GPT' 'NTFS' $label } | Out-Null
      $root = ((Letters $dest) | Select-Object -First 1) + ':\'
      $done = 0
      Step 'Copy files' {
        foreach ($f in $files) {
          $to = Join-Path $root $f.Rel
          New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($to)) | Out-Null
          Copy-Item -LiteralPath $f.Src -Destination $to -Force
          $done++; if ($done % 25 -eq 0 -or $done -eq $files.Count) { Note 'copy' @{ done = $done; total = $files.Count } }
        }
        "$done files"
      } | Out-Null
      $bad = New-Object System.Collections.Generic.List[string]; $checked = 0
      Step 'Check every file (SHA-256)' {
        foreach ($f in $files) {
          $a = (Get-FileHash -LiteralPath $f.Src -Algorithm SHA256).Hash
          $b = (Get-FileHash -LiteralPath (Join-Path $root $f.Rel) -Algorithm SHA256).Hash
          if ($a -ne $b) { $bad.Add($f.Rel) }
          $checked++; if ($checked % 25 -eq 0 -or $checked -eq $files.Count) { Note 'verify' @{ done = $checked; total = $files.Count } }
        }
        if ($bad.Count) { throw "$($bad.Count) file(s) differ from their originals; the disk is kept attached so you can look." }
        "$checked files match"
      } | Out-Null
      $data.verified = $checked; $data.mismatches = @($bad)
      Step 'Detach' { Dismount-DiskImage -ImagePath $dest | Out-Null } | Out-Null
      $data.disk = Info $dest
    }
    default { throw "Unknown operation: $($req.op)" }
  }
  $out = [ordered]@{ ok = $true; steps = $steps; data = $data }
} catch {
  $out = [ordered]@{ ok = $false; error = $_.Exception.Message; steps = $steps; data = $data }
}
$out | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Result -Encoding UTF8
