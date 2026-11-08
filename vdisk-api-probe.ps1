# Probe of the Windows virtual disk API on a hosted Windows runner. It answers one question per
# step: does this call work here without Hyper-V, and with which open mode? Every step prints its
# Win32 result code; nothing here is used by the app. ASCII only (Windows PowerShell 5.1).
param([ValidateSet('api', 'mirror', 'vhdset', 'sentinel', 'vhdset-flags')][string]$Part = 'api', [int]$Variant = 1)
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
  [DllImport("virtdisk.dll", EntryPoint = "MirrorVirtualDisk")] public static extern uint MirrorPtr(IntPtr h, uint flags, IntPtr p, IntPtr overlapped);
  // Starts a mirror, waits for the copy to finish, then switches to the mirror. The parameters,
  // the path and the OVERLAPPED stay in unmanaged memory until the operation is over.
  public static string Mirror(IntPtr h, string dest) {
    IntPtr ov = Marshal.AllocHGlobal(64), prm = Marshal.AllocHGlobal(16), path = Marshal.StringToHGlobalUni(dest);
    try {
      for (int i = 0; i < 64; i++) Marshal.WriteByte(ov, i, 0);
      for (int i = 0; i < 16; i++) Marshal.WriteByte(prm, i, 0);
      Marshal.WriteIntPtr(ov, IntPtr.Size == 8 ? 24 : 16, CreateEvent(IntPtr.Zero, true, false, IntPtr.Zero));
      Marshal.WriteInt32(prm, 0, 1); Marshal.WriteIntPtr(prm, 8, path);
      uint r = MirrorPtr(h, 0, prm, ov);
      string log = "start=" + r;
      if (r != 0 && r != 997) return log;
      for (int i = 0; i < 900; i++) {
        PROGRESS pr; uint g = GetVirtualDiskOperationProgress(h, ov, out pr);
        if (g != 0) { log += " progress=" + g; break; }
        if (pr.OperationStatus != 997 || (pr.CompletionValue > 0 && pr.CurrentValue >= pr.CompletionValue)) { log += " status=" + pr.OperationStatus + " " + pr.CurrentValue + "/" + pr.CompletionValue; break; }
        Thread.Sleep(200);
      }
      log += " break=" + BreakMirrorVirtualDisk(h);
      for (int i = 0; i < 50; i++) { PROGRESS pr; if (GetVirtualDiskOperationProgress(h, ov, out pr) != 0 || pr.OperationStatus != 997) { log += " final=" + pr.OperationStatus; break; } Thread.Sleep(200); }
      return log;
    } finally { Marshal.FreeHGlobal(prm); Marshal.FreeHGlobal(path); Marshal.FreeHGlobal(ov); }
  }
  [DllImport("virtdisk.dll", CharSet = CharSet.Unicode, EntryPoint = "CreateVirtualDisk")] public static extern uint CreateRaw(ref STORAGE_TYPE t, string path, uint access, IntPtr sd, uint flags, uint providerFlags, IntPtr p, IntPtr overlapped, out IntPtr h);
  [DllImport("virtdisk.dll", CharSet = CharSet.Unicode, EntryPoint = "OpenVirtualDisk")] public static extern uint OpenRaw(ref STORAGE_TYPE t, string path, uint access, uint flags, IntPtr p, out IntPtr h);
  static IntPtr Fill(int n) { IntPtr b = Marshal.AllocHGlobal(n); for (int i = 0; i < n; i++) Marshal.WriteByte(b, i, 0xCD); return b; }
  static string Changed(IntPtr b, int from, int to) { for (int i = from; i < to; i++) if (Marshal.ReadByte(b, i) != 0xCD) return "first change at byte " + i; return "nothing written past byte " + from; }
  // Creates a VHDX from a 512-byte buffer laid out like CREATE_VIRTUAL_DISK_PARAMETERS version 2
  // and reports whether the call wrote anything past the 128 bytes that version 2 needs.
  public static string CreateSentinel(string path) {
    IntPtr b = Fill(512);
    try {
      for (int i = 0; i < 128; i++) Marshal.WriteByte(b, i, 0);
      Marshal.WriteInt32(b, 0, 2); Marshal.WriteInt64(b, 24, 1073741824);
      var t = Type(3); IntPtr h; uint r = CreateRaw(ref t, path, 0, IntPtr.Zero, 0, 0, b, IntPtr.Zero, out h);
      if (r == 0) CloseHandle(h);
      return "code=" + r + " " + Changed(b, 128, 512) + " inside=" + Changed2(b);
    } finally { Marshal.FreeHGlobal(b); }
  }
  static string Changed2(IntPtr b) { var sb = new System.Text.StringBuilder(); for (int i = 0; i < 128; i += 8) sb.Append(Marshal.ReadInt64(b, i).ToString("x")).Append(i == 120 ? "" : ","); return sb.ToString(); }
  // Opens a disk from a 256-byte buffer laid out like OPEN_VIRTUAL_DISK_PARAMETERS version 2 (28 bytes).
  public static string OpenSentinel(string path) {
    IntPtr b = Fill(256);
    try {
      for (int i = 0; i < 28; i++) Marshal.WriteByte(b, i, 0);
      Marshal.WriteInt32(b, 0, 2);
      var t = Type(0); IntPtr h; uint r = OpenRaw(ref t, path, 0, 0, b, out h);
      if (r == 0) CloseHandle(h);
      return "code=" + r + " " + Changed(b, 28, 256);
    } finally { Marshal.FreeHGlobal(b); }
  }
  // CreateVirtualDisk for a VHD Set from a 512-byte buffer with a sentinel tail, laid out like
  // CREATE_VIRTUAL_DISK_PARAMETERS version 2 (128 bytes), 3 (160) or 4 (184). Version 3 adds
  // SourceLimitPath at 128 and BackingStorageType at 136. flags 0x8 is
  // CREATE_VIRTUAL_DISK_FLAG_CREATE_BACKING_STORAGE.
  public static string CreateSet(string path, uint version, uint flags, uint backing) {
    IntPtr b = Fill(512);
    int n = version == 2 ? 128 : version == 3 ? 160 : 184;
    try {
      for (int i = 0; i < n; i++) Marshal.WriteByte(b, i, 0);
      Marshal.WriteInt32(b, 0, (int)version); Marshal.WriteInt64(b, 24, 1073741824L);
      if (version >= 3 && backing != 0) { Marshal.WriteInt32(b, 136, (int)backing); Marshal.Copy(MS.ToByteArray(), 0, b + 140, 16); }
      var t = Type(4); IntPtr h; uint r = CreateRaw(ref t, path, 0, IntPtr.Zero, flags, 0, b, IntPtr.Zero, out h);
      if (r == 0) CloseHandle(h);
      return "code=" + r + " " + Changed(b, n, 512);
    } finally { Marshal.FreeHGlobal(b); }
  }
  // CreateVirtualDisk with explicit choices, for trying VHD Set creation several ways.
  public static uint CreateWith(string path, uint device, bool msVendor, uint block, uint sector, uint physical) {
    var t = new STORAGE_TYPE { DeviceId = device, VendorId = msVendor ? MS : Guid.Empty };
    var p = new CREATE_V2 { Version = 2, MaximumSize = 1073741824, BlockSizeInBytes = block, SectorSizeInBytes = sector, PhysicalSectorSizeInBytes = physical };
    IntPtr h; uint r = CreateVirtualDisk(ref t, path, 0, IntPtr.Zero, 0, 0, ref p, IntPtr.Zero, out h);
    if (r == 0) CloseHandle(h);
    return r;
  }
}
'@

$results = New-Object System.Collections.ArrayList
function Row([string]$step, $code, [string]$detail = '') {
  $msg = if ($code -is [int] -or $code -is [uint32]) { if ([int64]$code -eq 0) { 'ok' } else { (New-Object System.ComponentModel.Win32Exception([BitConverter]::ToInt32([BitConverter]::GetBytes([uint32]([int64]$code -band 0xFFFFFFFFL)), 0))).Message } } else { [string]$code }
  [void]$results.Add([pscustomobject]@{ Step = $step; Code = $code; Meaning = $msg; Detail = $detail })
  Write-Host ("{0,-46} {1,6}  {2}  {3}" -f $step, $code, $msg, $detail)
}
function Attempt([string]$step, [scriptblock]$body) { try { & $body } catch { Row $step 'exception' $_.Exception.Message } }

$os = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
Write-Host ("Part $Part on " + $os.ProductName + " build " + $os.CurrentBuild)

$vhdx = Join-Path $root 'probe.vhdx'
$mirror = Join-Path $root 'probe-mirror.vhdx'
$gb = [uint64]1073741824

function DiskPart([string[]]$lines) {
  $f = Join-Path $root ('dp-' + [Guid]::NewGuid().ToString('N') + '.txt')
  [IO.File]::WriteAllLines($f, $lines, [Text.Encoding]::Unicode)
  $out = & diskpart.exe /s $f 2>&1 | Out-String
  Remove-Item -LiteralPath $f -Force
  return $out
}

if ($Part -eq 'api') {
  Attempt 'create VHDX' { Row 'create VHDX' ([Probe]::Create($vhdx, 3, $gb)) }
  foreach ($mode in @('v2', 'v1-all')) {
    $h = [IntPtr]::Zero
    $r = if ($mode -eq 'v2') { [Probe]::Open($vhdx, 3, 0, [ref]$h) } else { [Probe]::OpenAll($vhdx, 3, 0, [ref]$h) }
    Row "open VHDX ($mode)" $r
    if ($r -ne 0) { continue }
    try {
      $c = 0; Row "get identifier ($mode)" 0 ([Probe]::Info($h, 2, [ref]$c))
      $s = New-Object Probe+SET_INFO; $s.Version = 2; $s.Id = [Guid]::NewGuid(); Row "set identifier ($mode)" ([Probe]::SetVirtualDiskInformation($h, [ref]$s)) $s.Id
      $s = New-Object Probe+SET_INFO; $s.Version = 5; $s.Id = [Guid]::NewGuid(); Row "set virtual disk id ($mode)" ([Probe]::SetVirtualDiskInformation($h, [ref]$s)) $s.Id
      $item = [Guid]::NewGuid(); $bytes = [Text.Encoding]::Unicode.GetBytes('probe value')
      Row "metadata set ($mode)" ([Probe]::SetVirtualDiskMetadata($h, [ref]$item, [uint32]$bytes.Length, $bytes)) $item
      $n = [uint32]64; $items = New-Object Guid[] 64; Row "metadata enumerate ($mode)" ([Probe]::EnumerateVirtualDiskMetadata($h, [ref]$n, $items)) ("count=" + $n)
      Row "metadata delete ($mode)" ([Probe]::DeleteVirtualDiskMetadata($h, [ref]$item))
      $s = New-Object Probe+SET_INFO; $s.Version = 6; $s.Enabled = 1; Row "change tracking on ($mode)" ([Probe]::SetVirtualDiskInformation($h, [ref]$s))
      $c = 0; Row "change tracking state ($mode)" 0 ([Probe]::Info($h, 15, [ref]$c))
      $s = New-Object Probe+SET_INFO; $s.Version = 6; $s.Enabled = 0; Row "change tracking off ($mode)" ([Probe]::SetVirtualDiskInformation($h, [ref]$s))
    } finally { [void][Probe]::CloseHandle($h) }
  }
  Write-Host 'api part finished'
}

if ($Part -eq 'mirror') {
  Attempt 'create VHDX' { Row 'create VHDX' ([Probe]::Create($vhdx, 3, $gb)) }
  foreach ($attached in @($false, $true)) {
    if ($attached) { Write-Host (DiskPart @("select vdisk file=`"$vhdx`"", 'attach vdisk')) }
    Remove-Item -LiteralPath $mirror -Force -ErrorAction SilentlyContinue
    $h = [IntPtr]::Zero; $r = [Probe]::Open($vhdx, 3, 0, [ref]$h); Row "open VHDX (attached=$attached)" $r
    if ($r -eq 0) { try { Row "mirror and break (attached=$attached)" 'log' ([Probe]::Mirror($h, $mirror)) } finally { [void][Probe]::CloseHandle($h) } }
    Row "mirror file exists (attached=$attached)" ([int](-not (Test-Path $mirror))) $(if (Test-Path $mirror) { (Get-Item $mirror).Length } else { '' })
    if ($attached) { Write-Host (DiskPart @("select vdisk file=`"$vhdx`"", 'detach vdisk')) }
  }
  Write-Host 'mirror part finished'
}

if ($Part -eq 'sentinel') {
  foreach ($k in 1..3) { Row "create VHDX from a sentinel buffer ($k)" 'log' ([Probe]::CreateSentinel((Join-Path $root "sentinel-$k.vhdx"))) }
  foreach ($k in 1..3) { Row "open VHDX from a sentinel buffer ($k)" 'log' ([Probe]::OpenSentinel((Join-Path $root "sentinel-1.vhdx"))) }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers(); $junk = 1..20000 | ForEach-Object { New-Object byte[] 256 }
  Write-Host 'sentinel part finished'
}

if ($Part -eq 'vhdset') {
  $newVhd = Get-Command New-VHD -ErrorAction SilentlyContinue
  Write-Host ('New-VHD: ' + $(if ($newVhd) { $newVhd.Source } else { 'not available' }))
  Row 'Hyper-V New-VHD available' ([int](-not $newVhd)) $(if ($newVhd) { $newVhd.Source } else { '' })
  $set = Join-Path $root 'hv.vhds'
  if ($newVhd) { Attempt 'New-VHD .vhds' { New-VHD -Path $set -SizeBytes 1GB -Dynamic | Out-Null; Row 'New-VHD .vhds' 0 ((Get-ChildItem $root -Filter 'hv*' | ForEach-Object { $_.Name + '=' + $_.Length }) -join ',') } }
  $i = 0
  foreach ($v in @(@(4, $true, 0, 0, 0), @(4, $true, 33554432, 512, 4096), @(4, $false, 0, 0, 0), @(0, $false, 0, 0, 0), @(3, $true, 0, 0, 0))) {
    $i++; $p = Join-Path $root ("set-$i.vhds")
    Attempt "create .vhds variant $i" { Row ("create .vhds variant $i (device " + $v[0] + ', ms vendor ' + $v[1] + ', block ' + $v[2] + ', sector ' + $v[3] + '/' + $v[4] + ')') ([Probe]::CreateWith($p, [uint32]$v[0], [bool]$v[1], [uint32]$v[2], [uint32]$v[3], [uint32]$v[4])) ((Get-ChildItem $root -Filter "set-$i*" | ForEach-Object { $_.Name + '=' + $_.Length }) -join ',') }
  }
  $made = Get-Item -LiteralPath (Join-Path $root 'hv.vhds') -ErrorAction SilentlyContinue
  if ($made) {
    foreach ($flags in @(0, 16)) {
      $h = [IntPtr]::Zero; $r = [Probe]::Open($made.FullName, 4, [uint32]$flags, [ref]$h); Row "open $($made.Name) (flags $flags)" $r
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
    Write-Host ('Files: ' + ((Get-ChildItem $root | ForEach-Object { $_.Name + '=' + $_.Length }) -join ', '))
  }
  Write-Host 'vhdset part finished'
}

if ($Part -eq 'vhdset-flags') {
  # version, flags, backing storage type: each variant runs in its own process.
  $v = @(@(2, 8, 0), @(3, 8, 3), @(3, 8, 0), @(4, 8, 3), @(3, 0, 3))[$Variant - 1]
  $set = Join-Path $root ("api-set-$Variant.vhds")
  $label = "create .vhds through the API (version $($v[0]), flags $($v[1]), backing $($v[2]))"
  $log = [Probe]::CreateSet($set, [uint32]$v[0], [uint32]$v[1], [uint32]$v[2])
  $code = [int64]($log -replace '^code=(\d+).*$', '$1')
  Row $label 'log' ($log + ' files: ' + ((Get-ChildItem $root -Filter "api-set-$Variant*" | ForEach-Object { $_.Name + '=' + $_.Length }) -join ','))
  if ($code -eq 0) {
    $h = [IntPtr]::Zero; $r = [Probe]::Open($set, 4, 0, [ref]$h); Row "open the API-made set (variant $Variant)" $r
    if ($r -eq 0) {
      try {
        $snap = [Guid]::NewGuid(); $t = New-Object Probe+SNAP_TAKE; $t.Version = 1; $t.SnapshotId = $snap
        $tr = [Probe]::TakeSnapshotVhdSet($h, [ref]$t, 0); Row "take a checkpoint on the API-made set (variant $Variant)" $tr $snap
        if ($tr -eq 0) { $d = New-Object Probe+SNAP_DELETE; $d.Version = 1; $d.SnapshotId = $snap; Row "delete it (variant $Variant)" ([Probe]::DeleteSnapshotVhdSet($h, [ref]$d, 0)) }
      } finally { [void][Probe]::CloseHandle($h) }
    }
    try { Mount-DiskImage -ImagePath $set -PassThru | Out-Null; Row "attach the API-made set (variant $Variant)" 0; Dismount-DiskImage -ImagePath $set | Out-Null; Row "detach it (variant $Variant)" 0 } catch { Row "attach the API-made set (variant $Variant)" 'exception' $_.Exception.Message }
  }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers(); $junk = 1..20000 | ForEach-Object { New-Object byte[] 256 }
  Write-Host "vhdset-flags variant $Variant finished"
}

$md = @("### Part $Part", '', '| Step | Code | Meaning | Detail |', '| --- | --- | --- | --- |') + ($results | ForEach-Object { "| $($_.Step) | $($_.Code) | $($_.Meaning) | $($_.Detail) |" })
if ($env:GITHUB_STEP_SUMMARY) { $md -join "`n" | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Encoding utf8 -Append }
