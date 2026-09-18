. (Join-Path $PSScriptRoot 'windows-common.ps1')

Initialize-QiuzhengRuntimeDirectories
Import-QiuzhengEnvironment

$postgresBin = Find-PostgresBin
$pgCtl = Join-Path $postgresBin 'pg_ctl.exe'
$pgIsReady = Join-Path $postgresBin 'pg_isready.exe'
$initDb = Join-Path $postgresBin 'initdb.exe'
$psql = Join-Path $postgresBin 'psql.exe'
$createdb = Join-Path $postgresBin 'createdb.exe'
$npm = (Get-Command 'npm.cmd' -ErrorAction Stop).Source
$node = (Get-Command 'node.exe' -ErrorAction Stop).Source
$vite = Join-Path $script:RepoRoot 'node_modules\vite\bin\vite.js'
$startedProcesses = @()

try {
  if (Test-Path -LiteralPath $script:PidFile) {
    $previousState = Get-Content -LiteralPath $script:PidFile -Raw | ConvertFrom-Json
    $livePrevious = @(
      @($previousState.api, $previousState.worker, $previousState.web) | Where-Object {
        $_ -and (Get-Process -Id $_ -ErrorAction SilentlyContinue)
      }
    )
    if ($livePrevious.Count -gt 0) {
      throw 'Qiuzheng is already running. Run npm run windows:stop first.'
    }
    Remove-Item -LiteralPath $script:PidFile
  }

  if (Test-TcpPort -HostName '127.0.0.1' -Port $script:ApiPort) {
    throw "Port $($script:ApiPort) is already in use."
  }
  if (Test-TcpPort -HostName '127.0.0.1' -Port $script:WebPort) {
    throw "Port $($script:WebPort) is already in use."
  }

  Write-Host '[1/7] Checking the isolated PostgreSQL instance...'
  if (-not (Test-Path -LiteralPath (Join-Path $script:PostgresData 'PG_VERSION'))) {
    Invoke-NativeCommand -FilePath $initDb -Arguments @(
      '-D', $script:PostgresData,
      '--username=qiuzheng',
      '--auth=trust',
      '--encoding=UTF8',
      '--locale=C'
    )
  }

  & $pgIsReady '-h' '127.0.0.1' '-p' ([string]$script:PostgresPort) | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Invoke-NativeCommand -FilePath $pgCtl -Arguments @(
      '-D', $script:PostgresData,
      '-l', $script:PostgresLog,
      '-o', "-p $($script:PostgresPort) -h 127.0.0.1",
      'start'
    )
  }

  Write-Host '[2/7] Checking the database and Redis...'
  $databaseExists = & $psql '-h' '127.0.0.1' '-p' ([string]$script:PostgresPort) '-U' 'qiuzheng' '-d' 'postgres' '-tAc' "SELECT 1 FROM pg_database WHERE datname='qiuzheng'"
  if ($LASTEXITCODE -ne 0) { throw 'Cannot connect to the project PostgreSQL instance.' }
  if ($databaseExists.Trim() -ne '1') {
    Invoke-NativeCommand -FilePath $createdb -Arguments @(
      '-h', '127.0.0.1',
      '-p', ([string]$script:PostgresPort),
      '-U', 'qiuzheng',
      'qiuzheng'
    )
  }

  if (-not (Test-TcpPort -HostName '127.0.0.1' -Port 6379)) {
    $memurai = Get-Service -Name 'Memurai' -ErrorAction SilentlyContinue
    if ($memurai) {
      Start-Service -Name 'Memurai'
      Start-Sleep -Seconds 1
    }
  }
  if (-not (Test-TcpPort -HostName '127.0.0.1' -Port 6379)) {
    throw 'Redis/Memurai is not running at 127.0.0.1:6379.'
  }

  if (-not (Test-Path -LiteralPath (Join-Path $script:RepoRoot 'node_modules'))) {
    Write-Host '[3/7] Installing project dependencies...'
    Push-Location $script:RepoRoot
    try { Invoke-NativeCommand -FilePath $npm -Arguments @('install') } finally { Pop-Location }
  } else {
    Write-Host '[3/7] Project dependencies are installed.'
  }

  $python = Get-Command 'python' -ErrorAction SilentlyContinue
  if ($python) {
    Write-Host '[3b/7] Ensuring PyMuPDF4LLM (PDF to Markdown)...'
    try {
      & $python.Source -m pip install -r (Join-Path $script:RepoRoot 'apps\api\requirements-pdf.txt') | Out-Null
    } catch {
      Write-Host 'PyMuPDF4LLM install skipped; PDF conversion will fall back to unpdf.'
    }
  } else {
    Write-Host '[3b/7] Python not found; PDF conversion will fall back to unpdf.'
  }

  Write-Host '[4/7] Building the API and Web app...'
  Push-Location $script:RepoRoot
  try {
    Invoke-NativeCommand -FilePath $npm -Arguments @('run', 'prisma:generate', '-w', '@qiuzheng/api')
    Invoke-NativeCommand -FilePath $npm -Arguments @('run', 'build')
  } finally {
    Pop-Location
  }

  Write-Host '[5/7] Applying database migrations and seed data...'
  Push-Location $script:RepoRoot
  try {
    Invoke-NativeCommand -FilePath $npm -Arguments @('run', 'prisma:deploy', '-w', '@qiuzheng/api')
    Invoke-NativeCommand -FilePath $npm -Arguments @('run', 'seed', '-w', '@qiuzheng/api')
  } finally {
    Pop-Location
  }

  Write-Host '[6/7] Starting the API, worker, and Web app...'
  $api = Start-Process -FilePath $node `
    -ArgumentList @('apps/api/dist/server.js') `
    -WorkingDirectory $script:RepoRoot `
    -RedirectStandardOutput (Join-Path $script:LogsRoot 'api.out.log') `
    -RedirectStandardError (Join-Path $script:LogsRoot 'api.err.log') `
    -WindowStyle Hidden `
    -PassThru
  $startedProcesses += $api

  $worker = Start-Process -FilePath $node `
    -ArgumentList @('apps/api/dist/worker.js') `
    -WorkingDirectory $script:RepoRoot `
    -RedirectStandardOutput (Join-Path $script:LogsRoot 'worker.out.log') `
    -RedirectStandardError (Join-Path $script:LogsRoot 'worker.err.log') `
    -WindowStyle Hidden `
    -PassThru
  $startedProcesses += $worker

  $web = Start-Process -FilePath $node `
    -ArgumentList @($vite, 'preview', '--host', '127.0.0.1', '--port', ([string]$script:WebPort)) `
    -WorkingDirectory (Join-Path $script:RepoRoot 'apps\web') `
    -RedirectStandardOutput (Join-Path $script:LogsRoot 'web.out.log') `
    -RedirectStandardError (Join-Path $script:LogsRoot 'web.err.log') `
    -WindowStyle Hidden `
    -PassThru
  $startedProcesses += $web

  [ordered]@{
    api = $api.Id
    worker = $worker.Id
    web = $web.Id
    startedAt = (Get-Date).ToString('o')
  } | ConvertTo-Json | Set-Content -LiteralPath $script:PidFile -Encoding UTF8

  Write-Host '[7/7] Waiting for services to become ready...'
  Wait-HttpEndpoint -Uri "http://127.0.0.1:$($script:ApiPort)/health"
  Wait-HttpEndpoint -Uri "http://127.0.0.1:$($script:ApiPort)/ready"
  Wait-HttpEndpoint -Uri "http://127.0.0.1:$($script:WebPort)"
  Wait-HttpEndpoint -Uri "http://127.0.0.1:$($script:WebPort)/ready"

  Write-Host ''
  Write-Host 'Qiuzheng is running natively on Windows.' -ForegroundColor Green
  Write-Host "Web: http://localhost:$($script:WebPort)"
  Write-Host "API: http://localhost:$($script:ApiPort)"
  Write-Host 'Stop command: npm run windows:stop'
} catch {
  foreach ($process in $startedProcesses) {
    if ($process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
  if (Test-Path -LiteralPath $script:PidFile) {
    Remove-Item -LiteralPath $script:PidFile -ErrorAction SilentlyContinue
  }
  throw
}
