# Probe of the Windows virtual disk API on a hosted Windows runner. It answers one question per
# step: does this call work here without Hyper-V, and with which open mode? Every step prints its
# Win32 result code; nothing here is used by the app. ASCII only (Windows PowerShell 5.1).
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:RUNNER_TEMP 'vdisk-probe'
New-Item -ItemType Directory -Force -Path $root | Out-Null

Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; using System.Threading;
public static class Probe {
  public static readonly Guid MS = new Guid("EC984AEC-A0F9-47e9-901F-71415A66345B");
  [StructLayout(LayoutKind.Sequential)] public struct STORAGE_TYPE { public uint DeviceId; public Guid VendorId; }
  [StructLayout(LayoutKind.Sequential)] public struct OPEN_V1 { public uint Version; public uint RWDepth; }
  [StructLayout(LayoutKind.Sequential)] public struct OPEN_V2 { public uint Version; public int GetInfoOnly; public int ReadOnly; public Guid ResiliencyGuid; }
  [StructLayout(LayoutKind.Explicit, Size = 128)] public struct CREATE_V2 {
    [FieldOffset(0)] public uint Version; [FieldOffset(8)] public Guid UniqueId; [FieldOffset(24)] public ulong MaximumSize;
    [FieldOffset(32)] public uint BlockSizeInBytes; [FieldOffset(36)] public uint SectorSizeInBytes; [FieldOffset(40)] public uint PhysicalSectorSizeInBytes;
    [FieldOffset(48)] public IntPtr ParentPath; [FieldOffset(56)] public IntPtr SourcePath; [FieldOffset(64)] public uint OpenFlags;
    [FieldOffset(68)] public uint ParentDeviceId; [FieldOffset(72)] public Guid ParentVendorId;
    [FieldOffset(88)] public uint SourceDeviceId; [FieldOffset(92)] public Guid SourceVendorId; [FieldOffset(108)] public Guid ResiliencyGuid; }
  [StructLayout(LayoutKind.Sequential)] public struct SNAP_TAKE { public uint Version; public Guid SnapshotId; }
  [StructLayout(LayoutKind.Sequential)] public struct SNAP_APPLY { public uint Version; public Guid SnapshotId; public Guid LeafSnapshotId; }
  [StructLayout(LayoutKind.Sequential)] public struct SNAP_DELETE { public uint Version; public Guid SnapshotId; }
  [StructLayout(LayoutKind.Explicit, Size = 32)] public struct SET_INFO { [FieldOffset(0)] public uint Version; [FieldOffset(8)] public Guid Id; [FieldOffset(8)] public int Enabled; }
  [StructLayout(LayoutKind.Sequential)] public struct MIRROR_V1 { public uint Version; [MarshalAs(UnmanagedType.LPWStr)] public string Path; }
  [StructLayout(LayoutKind.Sequential)] public struct PROGRESS { public uint OperationStatus; public ulong CurrentValue; public ulong CompletionValue; }
  [StructLayout(LayoutKind.Sequential)] public struct RANGE { public ulong ByteOffset; public ulong ByteLength; public ulong Reserved; }

  [DllImport("virtdisk.dll", CharSet = CharSet.Unicode)] public static extern uint CreateVirtualDisk(ref STORAGE_TYPE t, string path, uint access, IntPtr sd, uint flags, uint providerFlags, ref CREATE_V2 p, IntPtr overlapped, out IntPtr h);
  [DllImport("virtdisk.dll", CharSet = CharSet.Unicode, EntryPoint = "OpenVirtualDisk")] public static extern uint OpenV2(ref STORAGE_TYPE t, string path, uint access, uint flags, ref OPEN_V2 p, out IntPtr h);
  [DllImport("virtdisk.dll", CharSet = CharSet.Unicode, EntryPoint = "OpenVirtualDisk")] public static extern uint OpenV1(ref STORAGE_TYPE t, string path, uint access, uint flags, ref OPEN_V1 p, out IntPtr h);
  [DllImport("virtdisk.dll")] public static extern uint TakeSnapshotVhdSet(IntPtr h, ref SNAP_TAKE p, uint flags);
  [DllImport("virtdisk.dll")] public static extern uint ApplySnapshotVhdSet(IntPtr h, ref SNAP_APPLY p, uint flags);
  [DllImport("virtdisk.dll")] public static extern uint DeleteSnapshotVhdSet(IntPtr h, ref SNAP_DELETE p, uint flags);
  [DllImport("virtdisk.dll")] public static extern uint SetVirtualDiskInformation(IntPtr h, ref SET_INFO p);
  [DllImport("virtdisk.dll")] public static extern uint GetVirtualDiskInformation(IntPtr h, ref uint size, IntPtr info, out uint used);
  [DllImport("virtdisk.dll")] public static extern uint EnumerateVirtualDiskMetadata(IntPtr h, ref uint count, [Out] Guid[] items);
  [DllImport("virtdisk.dll")] public static extern uint GetVirtualDiskMetadata(IntPtr h, ref Guid item, ref uint size, [Out] byte[] buffer);
  [DllImport("virtdisk.dll")] public static extern uint SetVirtualDiskMetadata(IntPtr h, ref Guid item, uint size, byte[] buffer);
  [DllImport("virtdisk.dll")] public static extern uint DeleteVirtualDiskMetadata(IntPtr h, ref Guid item);
  [DllImport("virtdisk.dll", CharSet = CharSet.Unicode)] public static extern uint QueryChangesVirtualDisk(IntPtr h, string changeTrackingId, ulong offset, ulong length, uint flags, [Out] RANGE[] ranges, ref uint count, out ulong processed);
  [DllImport("virtdisk.dll")] public static extern uint MirrorVirtualDisk(IntPtr h, uint flags, ref MIRROR_V1 p, IntPtr overlapped);
  [DllImport("virtdisk.dll")] public static extern uint BreakMirrorVirtualDisk(IntPtr h);
  [DllImport("virtdisk.dll")] public static extern uint GetVirtualDiskOperationProgress(IntPtr h, IntPtr overlapped, out PROGRESS p);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll")] public static extern IntPtr CreateEvent(IntPtr a, bool manual, bool initial, IntPtr name);

  public static STORAGE_TYPE Type(uint device) { return new STORAGE_TYPE { DeviceId = device, VendorId = device == 0 ? Guid.Empty : MS }; }
  public static uint Create(string path, uint device, ulong size) {
    var t = Type(device);
    var p = new CREATE_V2 { Version = 2, UniqueId = Guid.Empty, MaximumSize = size };
    IntPtr h; uint r = CreateVirtualDisk(ref t, path, 0, IntPtr.Zero, 0, 0, ref p, IntPtr.Zero, out h);
    if (r == 0) CloseHandle(h);
    return r;
  }
  public static uint Open(string path, uint device, uint flags, out IntPtr h) { var t = Type(device); var o = new OPEN_V2 { Version = 2 }; return OpenV2(ref t, path, 0, flags, ref o, out h); }
  public static uint OpenAll(string path, uint device, uint flags, out IntPtr h) { var t = Type(device); var o = new OPEN_V1 { Version = 1, RWDepth = 1 }; return OpenV1(ref t, path, 0x003f0000, flags, ref o, out h); }
  public static string Info(IntPtr h, uint version, out uint code) {
    uint size = 4096; IntPtr buf = Marshal.AllocHGlobal(4096);
    try {
      for (int i = 0; i < 4096; i++) Marshal.WriteByte(buf, i, 0);
      Marshal.WriteInt32(buf, (int)version);
      uint used; code = GetVirtualDiskInformation(h, ref size, buf, out used);
      if (code != 0) return "";
      if (version == 2 || version == 14) { byte[] g = new byte[16]; Marshal.Copy(buf + 8, g, 0, 16); return new Guid(g).ToString(); }
      if (version == 15) return "enabled=" + Marshal.ReadInt32(buf, 8) + " newer=" + Marshal.ReadInt32(buf, 12) + " id=" + Marshal.PtrToStringUni(buf + 16);
      return "used=" + used;
    } finally { Marshal.FreeHGlobal(buf); }
  }
  // Starts a mirror, waits for the copy to finish, then switches to the mirror. Returns a step log.
  public static string Mirror(IntPtr h, string dest) {
    IntPtr ov = Marshal.AllocHGlobal(64);
    for (int i = 0; i < 64; i++) Marshal.WriteByte(ov, i, 0);
    Marshal.WriteIntPtr(ov, IntPtr.Size == 8 ? 24 : 16, CreateEvent(IntPtr.Zero, true, false, IntPtr.Zero));
    var p = new MIRROR_V1 { Version = 1, Path = dest };
    uint r = MirrorVirtualDisk(h, 0, ref p, ov);
    string log = "start=" + r;
    if (r != 0 && r != 997) return log;
    for (int i = 0; i < 600; i++) {
      PROGRESS pr; uint g = GetVirtualDiskOperationProgress(h, ov, out pr);
      if (g != 0) { log += " progress=" + g; break; }
      if (pr.OperationStatus != 997 || (pr.CompletionValue > 0 && pr.CurrentValue >= pr.CompletionValue)) { log += " status=" + pr.OperationStatus + " " + pr.CurrentValue + "/" + pr.CompletionValue; break; }
      Thread.Sleep(200);
    }
    log += " break=" + BreakMirrorVirtualDisk(h);
    return log;
  }
}
'@

$results = New-Object System.Collections.ArrayList
function Row([string]$step, $code, [string]$detail = '') {
  $msg = if ($code -is [int] -or $code -is [uint32]) { if ([int64]$code -eq 0) { 'ok' } else { (New-Object System.ComponentModel.Win32Exception([int]$code)).Message } } else { [string]$code }
  [void]$results.Add([pscustomobject]@{ Step = $step; Code = $code; Meaning = $msg; Detail = $detail })
  Write-Host ("{0,-46} {1,6}  {2}  {3}" -f $step, $code, $msg, $detail)
}
function Attempt([string]$step, [scriptblock]$body) { try { & $body } catch { Row $step 'exception' $_.Exception.Message } }

Write-Host ("Windows: " + (Get-CimInstance Win32_OperatingSystem).Caption + " " + [Environment]::OSVersion.Version)
Write-Host ("Hyper-V feature: " + ((Get-WindowsFeature -Name Hyper-V -ErrorAction SilentlyContinue).InstallState))

$vhdx = Join-Path $root 'probe.vhdx'
$set = Join-Path $root 'probe.vhds'
$mirror = Join-Path $root 'probe-mirror.vhdx'
$gb = [uint64]1073741824

Attempt 'create VHDX (CreateVirtualDisk v2)' { Row 'create VHDX (CreateVirtualDisk v2)' ([Probe]::Create($vhdx, 3, $gb)) }
Attempt 'create VHD Set (CreateVirtualDisk v2, device 4)' { Row 'create VHD Set (CreateVirtualDisk v2, device 4)' ([Probe]::Create($set, 4, $gb)) ((Get-ChildItem $root | ForEach-Object { $_.Name }) -join ',') }

foreach ($mode in @('v2', 'v1-all')) {
  $h = [IntPtr]::Zero
  $r = if ($mode -eq 'v2') { [Probe]::Open($vhdx, 3, 0, [ref]$h) } else { [Probe]::OpenAll($vhdx, 3, 0, [ref]$h) }
  Row "open VHDX ($mode)" $r
  if ($r -ne 0) { continue }
  try {
    $c = 0; $id = [Probe]::Info($h, 2, [ref]$c); Row "get identifier ($mode)" $c $id
    $c = 0; $vid = [Probe]::Info($h, 14, [ref]$c); Row "get virtual disk id ($mode)" $c $vid
    $s = New-Object Probe+SET_INFO; $s.Version = 2; $s.Id = [Guid]::NewGuid(); Row "set identifier ($mode)" ([Probe]::SetVirtualDiskInformation($h, [ref]$s)) $s.Id
    $c = 0; Row "identifier after set ($mode)" $c ([Probe]::Info($h, 2, [ref]$c))
    $s = New-Object Probe+SET_INFO; $s.Version = 5; $s.Id = [Guid]::NewGuid(); Row "set virtual disk id ($mode)" ([Probe]::SetVirtualDiskInformation($h, [ref]$s)) $s.Id
    $c = 0; Row "virtual disk id after set ($mode)" $c ([Probe]::Info($h, 14, [ref]$c))

    $item = [Guid]::NewGuid(); $bytes = [Text.Encoding]::Unicode.GetBytes('probe value')
    Row "metadata set ($mode)" ([Probe]::SetVirtualDiskMetadata($h, [ref]$item, [uint32]$bytes.Length, $bytes)) $item
    $n = [uint32]64; $items = New-Object Guid[] 64; Row "metadata enumerate ($mode)" ([Probe]::EnumerateVirtualDiskMetadata($h, [ref]$n, $items)) ("count=" + $n)
    $size = [uint32]4096; $buf = New-Object byte[] 4096; $g = [Probe]::GetVirtualDiskMetadata($h, [ref]$item, [ref]$size, $buf)
    Row "metadata get ($mode)" $g ($(if ($g -eq 0) { [Text.Encoding]::Unicode.GetString($buf, 0, $size) } else { '' }))
    Row "metadata delete ($mode)" ([Probe]::DeleteVirtualDiskMetadata($h, [ref]$item))

    $s = New-Object Probe+SET_INFO; $s.Version = 6; $s.Enabled = 1; Row "change tracking on ($mode)" ([Probe]::SetVirtualDiskInformation($h, [ref]$s))
    $c = 0; $state = [Probe]::Info($h, 15, [ref]$c); Row "change tracking state ($mode)" $c $state
    if ($state -match 'id=(\S+)') {
      $ranges = New-Object Probe+RANGE[] 16; $count = [uint32]16; $done = [uint64]0
      Row "query changes ($mode)" ([Probe]::QueryChangesVirtualDisk($h, $Matches[1], 0, $gb, 0, $ranges, [ref]$count, [ref]$done)) ("ranges=$count processed=$done")
    }
    $s = New-Object Probe+SET_INFO; $s.Version = 6; $s.Enabled = 0; Row "change tracking off ($mode)" ([Probe]::SetVirtualDiskInformation($h, [ref]$s))
  } finally { [void][Probe]::CloseHandle($h) }
}

# Mirroring needs the disk attached; attach it without a drive letter first.
Attempt 'mirror' {
  Mount-DiskImage -ImagePath $vhdx -NoDriveLetter | Out-Null
  Row 'attach for mirror' 0
  $h = [IntPtr]::Zero; $r = [Probe]::Open($vhdx, 3, 0, [ref]$h); Row 'open attached VHDX (v2)' $r
  if ($r -eq 0) { try { Row 'mirror and break' 'see detail' ([Probe]::Mirror($h, $mirror)) } finally { [void][Probe]::CloseHandle($h) } }
  Dismount-DiskImage -ImagePath $vhdx | Out-Null
  Row 'mirror file exists' ([int](-not (Test-Path $mirror))) $(if (Test-Path $mirror) { (Get-Item $mirror).Length } else { '' })
}

if (Test-Path $set) {
  foreach ($flags in @(0, 16)) {
    $h = [IntPtr]::Zero; $r = [Probe]::Open($set, 4, [uint32]$flags, [ref]$h); Row "open VHD Set (v2, flags $flags)" $r
    if ($r -ne 0) { continue }
    try {
      $snap = [Guid]::NewGuid(); $t = New-Object Probe+SNAP_TAKE; $t.Version = 1; $t.SnapshotId = $snap
      $tr = [Probe]::TakeSnapshotVhdSet($h, [ref]$t, 0); Row "take checkpoint (flags $flags)" $tr $snap
      if ($tr -eq 0) {
        $a = New-Object Probe+SNAP_APPLY; $a.Version = 1; $a.SnapshotId = $snap; $a.LeafSnapshotId = [Guid]::NewGuid()
        Row "apply checkpoint (flags $flags)" ([Probe]::ApplySnapshotVhdSet($h, [ref]$a, 0)) $a.LeafSnapshotId
        $d = New-Object Probe+SNAP_DELETE; $d.Version = 1; $d.SnapshotId = $snap
        Row "delete checkpoint (flags $flags)" ([Probe]::DeleteSnapshotVhdSet($h, [ref]$d, 0))
      }
    } finally { [void][Probe]::CloseHandle($h) }
  }
  Attempt 'attach VHD Set' { Mount-DiskImage -ImagePath $set -NoDriveLetter | Out-Null; Row 'attach VHD Set' 0 ((Get-DiskImage -ImagePath $set).Attached); Dismount-DiskImage -ImagePath $set | Out-Null }
  Write-Host ('Files: ' + ((Get-ChildItem $root | ForEach-Object { $_.Name + '=' + $_.Length }) -join ', '))
}

$md = @('| Step | Code | Meaning | Detail |', '| --- | --- | --- | --- |') + ($results | ForEach-Object { "| $($_.Step) | $($_.Code) | $($_.Meaning) | $($_.Detail) |" })
if ($env:GITHUB_STEP_SUMMARY) { $md -join "`n" | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Encoding utf8 -Append }
