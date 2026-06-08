$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 8787
$Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)

function Get-ContentType {
  param([string]$Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "application/javascript; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    default { "application/octet-stream" }
  }
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [byte[]]$Body,
    [string]$ContentType
  )

  $header = "HTTP/1.1 $StatusCode $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

function Get-LanUrls {
  Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -ne "127.0.0.1" -and
      $_.AddressState -eq "Preferred" -and
      $_.IPAddress -notlike "169.254.*"
    } |
    ForEach-Object { "http://$($_.IPAddress):$Port/index.html" }
}

try {
  $Listener.Start()
  Write-Host ""
  Write-Host "Sejong policy workbench is running."
  Write-Host "This computer: http://127.0.0.1:$Port/index.html"
  Write-Host "Other computers on the same network:"
  $LanUrls = @(Get-LanUrls)
  if ($LanUrls.Count -eq 0) {
    Write-Host "  No LAN IPv4 address found. Check Wi-Fi/Ethernet connection."
  }
  else {
    $LanUrls | ForEach-Object { Write-Host "  $_" }
  }
  Write-Host "Press Ctrl+C to stop."
  Write-Host ""

  while ($true) {
    $Client = $Listener.AcceptTcpClient()
    try {
      $Stream = $Client.GetStream()
      $Reader = [System.IO.StreamReader]::new($Stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $RequestLine = $Reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($RequestLine)) {
        continue
      }

      while (($Line = $Reader.ReadLine()) -ne $null -and $Line -ne "") {
      }

      $Parts = $RequestLine.Split(" ")
      $RequestPath = if ($Parts.Count -ge 2) { $Parts[1] } else { "/" }
      $RequestPath = [System.Uri]::UnescapeDataString($RequestPath.Split("?")[0]).TrimStart("/")
      if ([string]::IsNullOrWhiteSpace($RequestPath)) {
        $RequestPath = "index.html"
      }

      $LocalPath = Join-Path $Root $RequestPath
      $ResolvedRoot = [System.IO.Path]::GetFullPath($Root)
      $ResolvedPath = [System.IO.Path]::GetFullPath($LocalPath)

      if (-not $ResolvedPath.StartsWith($ResolvedRoot)) {
        $Body = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
        Send-Response $Stream 403 "Forbidden" $Body "text/plain; charset=utf-8"
        continue
      }

      if (-not (Test-Path -LiteralPath $ResolvedPath -PathType Leaf)) {
        $Body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
        Send-Response $Stream 404 "Not Found" $Body "text/plain; charset=utf-8"
        continue
      }

      $Bytes = [System.IO.File]::ReadAllBytes($ResolvedPath)
      Send-Response $Stream 200 "OK" $Bytes (Get-ContentType $ResolvedPath)
    }
    catch {
      try {
        $Body = [System.Text.Encoding]::UTF8.GetBytes("Server error")
        Send-Response $Stream 500 "Internal Server Error" $Body "text/plain; charset=utf-8"
      }
      catch {
      }
    }
    finally {
      if ($Reader) {
        $Reader.Dispose()
      }
      if ($Client) {
        $Client.Close()
      }
    }
  }
}
finally {
  $Listener.Stop()
}
