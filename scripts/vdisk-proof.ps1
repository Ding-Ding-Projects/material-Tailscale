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
$lines.Add("- Host: $($probe.data.edition) build $($probe.data.build); VirtDisk $($probe.data.virtdisk), Storage module $($probe.data.storage), Hyper-V module $($probe.data.hyperv), elevated $($probe.data.elevated)")
$r = Run 'create a 256 MB dynamic VHDX, partition, format NTFS and attach' @{ op = 'create'; path = $vhdx; type = 'dynamic'; sizeMB = 256; prepare = @{ style = 'GPT'; fs = 'NTFS'; label = 'Proof' }; attach = $true }
if ($r.ok) {
  $letter = @($r.data.disk.letters)[0]
  Set-Content -LiteralPath "$($letter):\hello.txt" -Value 'written inside the virtual disk'
  $lines.Add("- PASS wrote a file inside the attached disk at $($letter):\hello.txt")
}
Run 'refuse to create over an existing file' @{ op = 'create'; path = $vhdx; type = 'dynamic'; sizeMB = 64 } | ForEach-Object { if (-not $_.ok -and $_.error -match 'overwritten') { $script:failed--; $lines[$lines.Count - 1] = "- PASS refused to create over an existing file: $($_.error)" } }
Run 'detach' @{ op = 'detach'; path = $vhdx } | Out-Null
Run 'grow to 512 MB and extend the partition' @{ op = 'expand'; path = $vhdx; sizeMB = 512; extend = $true } | Out-Null
# The partition now reaches the end, so the disk alone cannot shrink; the script must say so in
# plain words. Shrinking the last partition first makes room, and the file written earlier must
# still read back afterwards.
$r = Run 'shrink the disk alone while its partition reaches the end' @{ op = 'shrink'; path = $vhdx }
if (-not $r.ok -and $r.error -match 'already as small as it can safely be') { $script:failed--; $lines[$lines.Count - 1] = "- PASS refused to cut into the partition: $($r.error)" }
$s = Run 'shrink the last partition (16 MB left free), then the disk' @{ op = 'shrink'; path = $vhdx; partition = $true; keepMB = 16 }
if ($s.ok) {
  $lines.Add("- Shrink steps: $((@($s.steps) | ForEach-Object { "$($_.name): $($_.detail)" }) -join '; ')")
  $now = [math]::Round($s.data.disk.virtualSize / 1MB)
  if ($now -lt 512) { $lines.Add("- PASS the disk is now $now MB instead of 512 MB") } else { $script:failed++; $lines.Add("- FAIL the disk is still $now MB after shrinking") }
  $ro = Run 'attach read-only to read the file back' @{ op = 'attach'; path = $vhdx; readOnly = $true }
  if ($ro.ok) {
    $l = @($ro.data.disk.letters)[0]
    $text = Get-Content -LiteralPath "$($l):\hello.txt" -Raw -ErrorAction SilentlyContinue
    if ($text -match 'written inside the virtual disk') { $lines.Add('- PASS the file written before the shrink reads back unchanged') } else { $script:failed++; $lines.Add("- FAIL the file written before the shrink did not read back from $($l):") }
    Run 'detach after reading' @{ op = 'detach'; path = $vhdx } | Out-Null
  }
}
Run 'compact (attached read-only while it runs)' @{ op = 'compact'; path = $vhdx } | Out-Null
$vhd = Join-Path $disks 'Proof disk (VHD).vhd'
Run 'convert the VHDX into a new dynamic VHD' @{ op = 'convert'; path = $vhdx; dest = $vhd; type = 'dynamic' } | Out-Null
$child = Join-Path $disks 'Proof child.vhdx'
Run 'create a differencing disk on the VHDX' @{ op = 'create'; path = $child; type = 'differencing'; parent = $vhdx } | Out-Null
Run 'attach the child read-only, then detach' @{ op = 'attach'; path = $child; readOnly = $true } | Out-Null
Run 'detach the child' @{ op = 'detach'; path = $child } | Out-Null
Run 'merge the child into its parent' @{ op = 'merge'; path = $child; depth = 1 } | Out-Null
$dt = Run 'read the details' @{ op = 'detail'; path = $vhdx }
if ($dt.ok) { $lines.Add('- Details: ' + (($dt.data.detail -split "`r?`n" | Where-Object { $_ }) -join '; ')) }
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

# Advanced: identity, custom metadata, change tracking and a live mirror on the VHDX; a VHD Set
# with checkpoints when the Hyper-V module is there to create one.
$a = Run 'read the advanced details' @{ op = 'advanced'; path = $vhdx }
$before = $a.data.advanced.identifier
$i = Run 'give the disk a new identifier' @{ op = 'identity'; path = $vhdx; which = 'identifier' }
if ($i.ok) { if ($i.data.advanced.identifier -eq $i.data.newValue -and $i.data.newValue -ne $before) { $lines.Add("- PASS the identifier changed from $before to $($i.data.newValue) and reads back") } else { $script:failed++; $lines.Add("- FAIL the identifier did not read back as $($i.data.newValue)") } }
Run 'give the disk a new virtual disk ID' @{ op = 'identity'; path = $vhdx; which = 'virtualDiskId' } | Out-Null
$m = Run 'write a metadata item' @{ op = 'meta-set'; path = $vhdx; text = 'Owner: release proof ' + [char]0x8B49 + [char]0x660E }
if ($m.ok) {
  $item = @($m.data.advanced.metadata) | Where-Object { $_.id -eq $m.data.item }
  if ($item -and $item.text -eq ('Owner: release proof ' + [char]0x8B49 + [char]0x660E)) { $lines.Add("- PASS the metadata item $($m.data.item) reads back as written ($($item.size) bytes)") } else { $script:failed++; $lines.Add('- FAIL the metadata item did not read back as written') }
  $d = Run 'delete the metadata item' @{ op = 'meta-delete'; path = $vhdx; item = $m.data.item }
  if ($d.ok -and -not (@($d.data.advanced.metadata) | Where-Object { $_.id -eq $m.data.item })) { $lines.Add('- PASS the metadata item is gone after deleting it') }
}
$t = Run 'turn change tracking on' @{ op = 'rct'; path = $vhdx; enabled = $true }
if ($t.ok -and $t.data.advanced.rct.enabled) {
  $since = $t.data.advanced.rct.id
  $lines.Add("- PASS change tracking is on; most recent point $since")
  Run 'attach to write after the tracking point' @{ op = 'attach'; path = $vhdx } | Out-Null
  $letter2 = @((Run 'read the letters' @{ op = 'info'; paths = @($vhdx) }).data.disks[0].letters)[0]
  if ($letter2) { [IO.File]::WriteAllBytes("$($letter2):\after-tracking.bin", [byte[]](1..262144 | ForEach-Object { $_ % 251 })) }
  Run 'detach after writing' @{ op = 'detach'; path = $vhdx } | Out-Null
  $c = Run 'list the blocks changed since that point' @{ op = 'rct-changes'; path = $vhdx; since = $since }
  if ($c.ok) { if ($c.data.changes.bytes -gt 0) { $lines.Add("- PASS $($c.data.changes.ranges) changed ranges, $($c.data.changes.bytes) bytes since the point") } else { $script:failed++; $lines.Add('- FAIL no changed blocks were reported after writing 256 KB') } }
  Run 'turn change tracking off' @{ op = 'rct'; path = $vhdx; enabled = $false } | Out-Null
}
$mirror = Join-Path $disks 'Proof disk (mirror).vhdx'
$mi = Run 'mirror the VHDX into a new file and switch' @{ op = 'mirror'; path = $vhdx; dest = $mirror }
if ($mi.ok -and (Test-Path -LiteralPath $mirror)) { $lines.Add("- PASS the mirror is a separate file of $((Get-Item -LiteralPath $mirror).Length) bytes") }
Run 'refuse to mirror over an existing file' @{ op = 'mirror'; path = $vhdx; dest = $mirror } | ForEach-Object { if (-not $_.ok -and $_.error -match 'overwritten') { $script:failed--; $lines[$lines.Count - 1] = "- PASS refused to mirror over an existing file: $($_.error)" } }
$set = Join-Path $disks 'Proof set.vhds'
if ($probe.data.hyperv) {
  $cs = Run 'create a 256 MB dynamic VHD Set (Hyper-V New-VHD)' @{ op = 'create'; path = $set; type = 'dynamic'; sizeMB = 256 }
  if ($cs.ok) {
    $tk = Run 'take a checkpoint' @{ op = 'checkpoint'; path = $set; action = 'take' }
    if ($tk.ok) {
      $ap = Run 'return to the checkpoint, keeping the current state' @{ op = 'checkpoint'; path = $set; action = 'apply'; id = $tk.data.id; keep = $true }
      if ($ap.ok -and $ap.data.kept) { $lines.Add("- PASS returned to $($tk.data.id); the current state was kept as $($ap.data.kept)") }
      Run 'delete the checkpoint' @{ op = 'checkpoint'; path = $set; action = 'delete'; id = $tk.data.id } | Out-Null
      $ls = Run 'list the checkpoints' @{ op = 'advanced'; path = $set }
      if ($ls.ok) { $lines.Add("- Checkpoints listed by Hyper-V: $(@($ls.data.advanced.checkpoints).Count)") }
    }
    Run 'attach the VHD Set, then detach' @{ op = 'attach'; path = $set } | Out-Null
    Run 'detach the VHD Set' @{ op = 'detach'; path = $set } | Out-Null
  }
} else {
  $r = Run 'refuse a VHD Set where Hyper-V is missing' @{ op = 'create'; path = $set; type = 'dynamic'; sizeMB = 256 }
  if (-not $r.ok -and $r.error -match 'Hyper-V') { $script:failed--; $lines[$lines.Count - 1] = "- PASS refused a VHD Set without Hyper-V: $($r.error)" }
}

$lines.Insert(0, "Ran the app's disk script on this runner: $($lines.Count - 1) results, $failed failed.")
$lines | Set-Content -LiteralPath $Out -Encoding UTF8
$lines
if ($failed -gt 0) { exit 1 }
