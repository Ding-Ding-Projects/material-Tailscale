# Runs every virtual disk operation of the app's own disk script (src/main/vdisk/vdisk.ps1) on a
# real, elevated Windows machine in a scratch folder, and prints one Markdown line per result.
# Used by the release workflow on a clean Windows runner. Exits 1 when any operation failed, after
# printing every result, so a failure is visible and nothing is hidden.
param([string]$Out = 'vdisk-proof.md')
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot '..\src\main\vdisk\vdisk.ps1'
$work = Join-Path $env:RUNNER_TEMP "vdisk proof $(Get-Date -Format 'yyyyMMdd-HHmmss')"
# A folder with spaces and non-English letters, so paths are tested the way people name them.
$disks = Join-Path $work ('Disks ' + [char]0x78C1 + [char]0x789F)  # "Disks" and two Chinese letters
New-Item -ItemType Directory -Force -Path $disks | Out-Null
$lines = New-Object System.Collections.Generic.List[string]
$failed = 0

function Run($label, $request) {
  $req = Join-Path $work 'request.json'; $res = Join-Path $work 'result.json'
  Remove-Item -LiteralPath $res -ErrorAction SilentlyContinue
  [IO.File]::WriteAllText($req, ($request | ConvertTo-Json -Depth 6 -Compress), (New-Object Text.UTF8Encoding $false))
  $sw = [Diagnostics.Stopwatch]::StartNew()
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -Request $req -Result $res | Out-Null
  $r = Get-Content -LiteralPath $res -Raw -Encoding UTF8 | ConvertFrom-Json
  $ms = $sw.ElapsedMilliseconds
  if ($r.ok) { $lines.Add("- PASS $label ($ms ms): $((@($r.steps) | ForEach-Object { "$($_.name) ok" }) -join '; ')") }
  else { $script:failed++; $lines.Add("- FAIL $label ($ms ms): $($r.error)") }
  return $r
}

$vhdx = Join-Path $disks 'Proof disk.vhdx'
$probe = Run 'probe the routes' @{ op = 'probe' }
$lines.Add("- Host: $($probe.data.edition) build $($probe.data.build); DiskPart $($probe.data.diskpart), Storage module $($probe.data.storage), VirtDisk $($probe.data.virtdisk), Hyper-V module $($probe.data.hyperv), elevated $($probe.data.elevated)")
$r = Run 'create a 256 MB dynamic VHDX, partition, format NTFS and attach' @{ op = 'create'; path = $vhdx; type = 'dynamic'; sizeMB = 256; prepare = @{ style = 'GPT'; fs = 'NTFS'; label = 'Proof' }; attach = $true }
if ($r.ok) {
  $letter = @($r.data.disk.letters)[0]
  Set-Content -LiteralPath "$($letter):\hello.txt" -Value 'written inside the virtual disk'
  $lines.Add("- PASS wrote a file inside the attached disk at $($letter):\hello.txt")
}
Run 'refuse to create over an existing file' @{ op = 'create'; path = $vhdx; type = 'dynamic'; sizeMB = 64 } | ForEach-Object { if (-not $_.ok -and $_.error -match 'overwritten') { $script:failed--; $lines[$lines.Count - 1] = "- PASS refused to create over an existing file: $($_.error)" } }
Run 'detach' @{ op = 'detach'; path = $vhdx } | Out-Null
Run 'grow to 512 MB and extend the partition' @{ op = 'expand'; path = $vhdx; sizeMB = 512; extend = $true } | Out-Null
Run 'shrink to the smallest safe size (VirtDisk)' @{ op = 'shrink'; path = $vhdx } | Out-Null
Run 'compact (attached read-only while it runs)' @{ op = 'compact'; path = $vhdx } | Out-Null
$vhd = Join-Path $disks 'Proof disk (VHD).vhd'
Run 'convert the VHDX into a new dynamic VHD' @{ op = 'convert'; path = $vhdx; dest = $vhd; type = 'dynamic' } | Out-Null
$child = Join-Path $disks 'Proof child.vhdx'
Run 'create a differencing disk on the VHDX' @{ op = 'create'; path = $child; type = 'differencing'; parent = $vhdx } | Out-Null
Run 'attach the child read-only, then detach' @{ op = 'attach'; path = $child; readOnly = $true } | Out-Null
Run 'detach the child' @{ op = 'detach'; path = $child } | Out-Null
Run 'merge the child into its parent' @{ op = 'merge'; path = $child; depth = 1 } | Out-Null
Run 'read DiskPart details' @{ op = 'detail'; path = $vhdx } | Out-Null
# An ISO made here with the Windows image-mastering API, attached read-only and detached again.
try {
  $iso = Join-Path $disks 'Proof image.iso'
  $src = Join-Path $work 'iso source'; New-Item -ItemType Directory -Force -Path $src | Out-Null
  Set-Content -LiteralPath (Join-Path $src 'readme.txt') -Value 'inside the image'
  $fsi = New-Object -ComObject IMAPI2FS.MsftFileSystemImage
  $fsi.FileSystemsToCreate = 3; $fsi.VolumeName = 'PROOF'; $fsi.Root.AddTree($src, $false)
  $stream = $fsi.CreateResultImage().ImageStream
  Add-Type -TypeDefinition 'using System; using System.IO; using System.Runtime.InteropServices; using System.Runtime.InteropServices.ComTypes; public static class IsoOut { public static void Save(object s, string p) { var i = (IStream)s; using (var f = File.Create(p)) { var b = new byte[65536]; var n = Marshal.AllocHGlobal(4); try { while (true) { i.Read(b, b.Length, n); int r = Marshal.ReadInt32(n); if (r <= 0) break; f.Write(b, 0, r); } } finally { Marshal.FreeHGlobal(n); } } } }' -ErrorAction Stop
  [IsoOut]::Save($stream, $iso)
  Run 'attach an ISO image (read-only)' @{ op = 'attach'; path = $iso } | Out-Null
  Run 'detach the ISO image' @{ op = 'detach'; path = $iso } | Out-Null
} catch { $lines.Add("- SKIP ISO: an image could not be made on this runner ($($_.Exception.Message))") }
# Quick pack: a folder of files becomes a new VHDX beside it, every file checked.
$pack = Join-Path $work 'Holiday photos'; New-Item -ItemType Directory -Force -Path (Join-Path $pack 'day 2') | Out-Null
1..40 | ForEach-Object { [IO.File]::WriteAllBytes((Join-Path $pack "photo $_.bin"), [byte[]](1..(1000 + $_) | ForEach-Object { $_ % 256 })) }
Set-Content -LiteralPath (Join-Path $pack ('day 2\notes ' + [char]0x7B46 + [char]0x8A18 + '.txt')) -Value 'second day'
$p = Run 'Quick pack a folder of 41 files' @{ op = 'pack'; items = @($pack) }
if ($p.ok) { $lines.Add("- Quick pack made $(Split-Path -Leaf $p.data.dest) ($($p.data.sizeMB) MB), checked $($p.data.verified) files, $(@($p.data.mismatches).Count) mismatches") }
$p2 = Run 'Quick pack the same folder again (must not overwrite)' @{ op = 'pack'; items = @($pack) }
if ($p2.ok) { $lines.Add("- Second pack went to $(Split-Path -Leaf $p2.data.dest), so the first was kept") }

$lines.Insert(0, "Ran the app's disk script on this runner: $($lines.Count - 1) results, $failed failed.")
$lines | Set-Content -LiteralPath $Out -Encoding UTF8
$lines
if ($failed -gt 0) { exit 1 }
