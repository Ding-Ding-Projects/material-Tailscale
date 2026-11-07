# Virtual disk operations for Material Tailscale, through routes every Windows edition has:
# DiskPart for create, grow, compact, convert and merge; the Storage module for attach, detach,
# ISO images, partitioning and formatting; and the VirtDisk API (virtdisk.dll) for shrinking a
# VHDX. The app runs this script elevated, after Windows asks for permission, with a JSON request
# file; it writes a JSON result file and appends progress lines to a progress file.
# Never overwrites a file and never deletes one.
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
function DiskPart([string[]]$lines) {
  $f = Join-Path ([IO.Path]::GetTempPath()) ("mt-diskpart-" + [guid]::NewGuid().ToString('N') + '.txt')
  # DiskPart reads its script as Unicode, so paths with any letters survive.
  [IO.File]::WriteAllLines($f, $lines, [Text.Encoding]::Unicode)
  try {
    $out = & "$env:SystemRoot\System32\diskpart.exe" /s $f 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw "DiskPart stopped with code $LASTEXITCODE. $($out.Trim() -split "`r?`n" | Select-Object -Last 3)" }
    return $out
  } finally { Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue }
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

# The VirtDisk API, for the one operation DiskPart and the Storage module lack on Windows Home.
$virtDisk = @'
using System; using System.Runtime.InteropServices;
public static class MtVirtDisk {
  [StructLayout(LayoutKind.Sequential)] public struct STORAGE_TYPE { public uint DeviceId; public Guid VendorId; }
  [StructLayout(LayoutKind.Sequential)] public struct OPEN_V2 { public uint Version; public int GetInfoOnly; public int ReadOnly; public Guid ResiliencyGuid; }
  [StructLayout(LayoutKind.Explicit)] public struct RESIZE_V1 { [FieldOffset(0)] public uint Version; [FieldOffset(8)] public ulong NewSize; }
  [DllImport("virtdisk.dll", CharSet = CharSet.Unicode)] static extern uint OpenVirtualDisk(ref STORAGE_TYPE t, string path, uint access, uint flags, ref OPEN_V2 p, out IntPtr h);
  [DllImport("virtdisk.dll")] static extern uint ResizeVirtualDisk(IntPtr h, uint flags, ref RESIZE_V1 p, IntPtr overlapped);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
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
}
'@

try {
  $req = Get-Content -LiteralPath $Request -Raw -Encoding UTF8 | ConvertFrom-Json
  $data.op = $req.op
  switch ($req.op) {
    'probe' {
      $os = Get-CimInstance Win32_OperatingSystem
      $data.edition = $os.Caption
      $data.build = $os.BuildNumber
      $data.diskpart = Test-Path -LiteralPath "$env:SystemRoot\System32\diskpart.exe"
      $data.storage = [bool](Get-Command Mount-DiskImage -ErrorAction SilentlyContinue)
      $data.virtdisk = Test-Path -LiteralPath "$env:SystemRoot\System32\virtdisk.dll"
      $data.hyperv = [bool](Get-Command New-VHD -ErrorAction SilentlyContinue)
      $data.elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    }
    'info' { $data.disks = @($req.paths | ForEach-Object { if (Test-Path -LiteralPath $_ -PathType Leaf) { Info $_ } else { [ordered]@{ path = $_; exists = $false } } }) }
    'create' {
      NeedNew $req.path
      $type = @{ dynamic = 'expandable'; fixed = 'fixed' }[$req.type]
      if ($req.type -eq 'differencing') {
        NeedFile $req.parent
        Step 'Create the disk' { DiskPart @("create vdisk file=`"$($req.path)`" parent=`"$($req.parent)`"") | Out-Null; 'differencing' } | Out-Null
      } else {
        Step 'Create the disk' { DiskPart @("create vdisk file=`"$($req.path)`" maximum=$([int64]$req.sizeMB) type=$type") | Out-Null; "$($req.sizeMB) MB $type" } | Out-Null
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
      Step 'Grow the disk' { DiskPart @("select vdisk file=`"$($req.path)`"", "expand vdisk maximum=$([int64]$req.sizeMB)") | Out-Null; "$($req.sizeMB) MB" } | Out-Null
      if ($req.extend) {
        Step 'Attach' { Attach $req.path $false $false } | Out-Null
        Step 'Extend the last partition' {
          $disk = Image $req.path | Get-Disk
          $part = Get-Partition -DiskNumber $disk.Number | Where-Object { $_.Type -ne 'Reserved' } | Sort-Object Offset | Select-Object -Last 1
          $max = (Get-PartitionSupportedSize -DiskNumber $disk.Number -PartitionNumber $part.PartitionNumber).SizeMax
          Resize-Partition -DiskNumber $disk.Number -PartitionNumber $part.PartitionNumber -Size $max
          "partition $($part.PartitionNumber) to $max bytes"
        } | Out-Null
        Step 'Detach' { Dismount-DiskImage -ImagePath $req.path | Out-Null } | Out-Null
      }
      $data.disk = Info $req.path
    }
    'shrink' {
      NeedFile $req.path; NeedDetached $req.path
      if ($req.path -notmatch '\.vhdx$') { throw 'Only a VHDX file can be shrunk.' }
      Step 'Shrink the disk' {
        Add-Type -TypeDefinition $virtDisk
        $code = [MtVirtDisk]::Shrink($req.path, [uint64]$(if ($req.sizeMB) { [int64]$req.sizeMB * 1MB } else { 0 }))
        if ($code -ne 0) { throw "The VirtDisk API refused the shrink: $((New-Object ComponentModel.Win32Exception([int]$code)).Message) (code $code)." }
        'smallest safe size'
      } | Out-Null
      $data.disk = Info $req.path
    }
    'compact' {
      NeedFile $req.path; NeedDetached $req.path
      Step 'Attach read-only' { Attach $req.path $true $true } | Out-Null
      try { Step 'Compact' { DiskPart @("select vdisk file=`"$($req.path)`"", 'compact vdisk') | Out-Null; 'compacted' } | Out-Null }
      finally { Step 'Detach' { Dismount-DiskImage -ImagePath $req.path | Out-Null } | Out-Null }
      $data.disk = Info $req.path
    }
    'convert' {
      NeedFile $req.path; NeedDetached $req.path; NeedNew $req.dest
      $type = @{ dynamic = 'expandable'; fixed = 'fixed' }[$req.type]
      Step 'Copy into the new format' { DiskPart @("create vdisk file=`"$($req.dest)`" source=`"$($req.path)`" type=$type") | Out-Null; "$($req.dest)" } | Out-Null
      $data.disk = Info $req.dest
    }
    'merge' {
      NeedFile $req.path; NeedDetached $req.path
      Step 'Merge into the parent' { DiskPart @("select vdisk file=`"$($req.path)`"", "merge vdisk depth=$([int]$req.depth)") | Out-Null; "depth $($req.depth)" } | Out-Null
    }
    'detail' { NeedFile $req.path; $data.detail = (Step 'Read the details' { DiskPart @("select vdisk file=`"$($req.path)`"", 'detail vdisk') }) }
    'pack' {
      $items = @($req.items | ForEach-Object { Get-Item -LiteralPath $_ })
      if (-not $items.Count) { throw 'Nothing to pack.' }
      $files = @(foreach ($it in $items) { if ($it.PSIsContainer) { Get-ChildItem -LiteralPath $it.FullName -Recurse -File -Force | ForEach-Object { [pscustomobject]@{ Src = $_.FullName; Rel = Join-Path $it.Name $_.FullName.Substring($it.FullName.Length).TrimStart('\') ; Len = $_.Length } } } else { [pscustomobject]@{ Src = $it.FullName; Rel = $it.Name; Len = $it.Length } } })
      $bytes = [int64]($files | Measure-Object Len -Sum).Sum
      # Content, one 4 KB cluster of slack per file, file-system overhead and 10% to spare.
      $mb = [math]::Ceiling(($bytes + $files.Count * 4096 + [math]::Max(64MB, $bytes * 0.03)) * 1.10 / 1MB)
      $mb = [math]::Max($mb, 64)
      $dir = Split-Path -LiteralPath $items[0].FullName -Parent
      $base = if ($items[0].PSIsContainer) { $items[0].Name } else { [IO.Path]::GetFileNameWithoutExtension($items[0].Name) }
      $dest = Join-Path $dir "$base.vhdx"; $n = 2
      while (Test-Path -LiteralPath $dest) { $dest = Join-Path $dir "$base ($n).vhdx"; $n++ }
      $data.dest = $dest; $data.files = $files.Count; $data.bytes = $bytes; $data.sizeMB = $mb
      Note 'plan' @{ dest = $dest; files = $files.Count; bytes = $bytes; sizeMB = $mb }
      Step 'Create the disk' { DiskPart @("create vdisk file=`"$dest`" maximum=$mb type=expandable") | Out-Null; "$mb MB" } | Out-Null
      Step 'Attach' { Attach $dest $false $false } | Out-Null
      $label = ($base -replace '[^A-Za-z0-9 _-]', '').Trim(); if (-not $label) { $label = 'Packed' }; if ($label.Length -gt 32) { $label = $label.Substring(0, 32) }
      Step 'Partition and format NTFS' { Prepare $dest 'GPT' 'NTFS' $label } | Out-Null
      $root = ((Letters $dest) | Select-Object -First 1) + ':\'
      $done = 0
      Step 'Copy files' {
        foreach ($f in $files) {
          $to = Join-Path $root $f.Rel
          New-Item -ItemType Directory -Force -Path (Split-Path -LiteralPath $to -Parent) | Out-Null
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
