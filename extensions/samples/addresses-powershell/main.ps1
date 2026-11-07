# Sample Material Tailscale extension in Windows PowerShell 5.1.
# Reads one JSON request from standard input and writes one JSON answer to standard output.
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$addresses = @($request.peer.addresses)
if ($addresses.Count -eq 0) {
  @{ ok = $false; message = 'This device reported no addresses.' } | ConvertTo-Json -Compress
  exit 0
}
@{ ok = $true; copy = ($addresses -join "`n"); message = "Copied $($addresses.Count) addresses." } | ConvertTo-Json -Compress
