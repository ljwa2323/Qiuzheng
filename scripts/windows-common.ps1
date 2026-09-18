$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$script:RepoRoot = Split-Path -Parent $PSScriptRoot
$script:RuntimeRoot = Join-Path $script:RepoRoot '.runtime'
$script:PostgresData = Join-Path $script:RuntimeRoot 'postgres-data'
$script:PostgresLog = Join-Path $script:RuntimeRoot 'postgres.log'
$script:LogsRoot = Join-Path $script:RuntimeRoot 'logs'
$script:ObjectsRoot = Join-Path $script:RuntimeRoot 'objects'
$script:PidFile = Join-Path $script:RuntimeRoot 'pids.json'
$script:PostgresPort = 55432
$script:ApiPort = 3000
$script:WebPort = 8080

function Initialize-QiuzhengRuntimeDirectories {
  New-Item -ItemType Directory -Force -Path $script:RuntimeRoot | Out-Null
  New-Item -ItemType Directory -Force -Path $script:LogsRoot | Out-Null
  New-Item -ItemType Directory -Force -Path $script:ObjectsRoot | Out-Null
}

function Import-QiuzhengEnvironment {
  $envFile = Join-Path $script:RepoRoot '.env'
  if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Missing $envFile. Copy .env.example to .env and configure its secrets first."
  }

  foreach ($line in Get-Content -LiteralPath $envFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }

    $separator = $trimmed.IndexOf('=')
    if ($separator -lt 1) { continue }

    $name = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()
    if ($value.Length -ge 2) {
      $quotedWithDouble = $value.StartsWith('"') -and $value.EndsWith('"')
      $quotedWithSingle = $value.StartsWith("'") -and $value.EndsWith("'")
      if ($quotedWithDouble -or $quotedWithSingle) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }

  if (-not $env:DATABASE_URL) { throw 'DATABASE_URL is missing from .env.' }

  $databaseUri = [UriBuilder]$env:DATABASE_URL
  $databaseUri.Host = '127.0.0.1'
  $databaseUri.Port = $script:PostgresPort
  $env:DATABASE_URL = $databaseUri.Uri.AbsoluteUri
  $env:REDIS_URL = 'redis://127.0.0.1:6379'
  $env:STORAGE_DRIVER = 'local'
  $env:LOCAL_STORAGE_PATH = $script:ObjectsRoot
  $env:CORS_ORIGIN = "http://localhost:$($script:WebPort)"
  $env:WEB_ORIGIN = "http://localhost:$($script:WebPort)"
  $env:API_PORT = [string]$script:ApiPort
  $env:NODE_ENV = 'development'
}

function Find-PostgresBin {
  $candidates = @(
    'D:\Programs\Postgresql\bin',
    'C:\Program Files\PostgreSQL\17\bin',
    'C:\Program Files\PostgreSQL\16\bin',
    'C:\Program Files\PostgreSQL\15\bin'
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath (Join-Path $candidate 'pg_ctl.exe')) {
      return $candidate
    }
  }

  $pgCtl = Get-Command 'pg_ctl.exe' -ErrorAction SilentlyContinue
  if ($pgCtl) { return Split-Path -Parent $pgCtl.Source }

  throw 'PostgreSQL command-line tools were not found. Install PostgreSQL 15 or newer.'
}

function Test-TcpPort {
  param(
    [Parameter(Mandatory = $true)][string]$HostName,
    [Parameter(Mandatory = $true)][int]$Port,
    [int]$TimeoutMilliseconds = 1000
  )

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $result = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $result.AsyncWaitHandle.WaitOne($TimeoutMilliseconds, $false)) { return $false }
    $client.EndConnect($result)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Test-HttpEndpoint {
  param(
    [Parameter(Mandatory = $true)][string]$Uri,
    [int]$TimeoutSeconds = 2
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec $TimeoutSeconds
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
  } catch {
    return $false
  }
}

function Wait-HttpEndpoint {
  param(
    [Parameter(Mandatory = $true)][string]$Uri,
    [int]$Attempts = 40,
    [int]$DelayMilliseconds = 500
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
    if (Test-HttpEndpoint -Uri $Uri) { return }
    Start-Sleep -Milliseconds $DelayMilliseconds
  }
  throw "Service did not become ready in time: $Uri"
}

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $false)][string[]]$Arguments = @()
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code $LASTEXITCODE`: $FilePath"
  }
}
