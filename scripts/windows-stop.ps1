. (Join-Path $PSScriptRoot 'windows-common.ps1')

Initialize-QiuzhengRuntimeDirectories

if (Test-Path -LiteralPath $script:PidFile) {
  $state = Get-Content -LiteralPath $script:PidFile -Raw | ConvertFrom-Json
  foreach ($name in @('web', 'worker', 'api')) {
    $processId = $state.$name
    if (-not $processId) { continue }
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
      Stop-Process -Id $processId -Force
      Write-Host "Stopped $name (PID $processId)."
    }
  }
  Remove-Item -LiteralPath $script:PidFile
} else {
  Write-Host 'No running Qiuzheng application processes were recorded.'
}

$postgresBin = Find-PostgresBin
$pgCtl = Join-Path $postgresBin 'pg_ctl.exe'
$pgIsReady = Join-Path $postgresBin 'pg_isready.exe'
& $pgIsReady '-h' '127.0.0.1' '-p' ([string]$script:PostgresPort) | Out-Null
if ($LASTEXITCODE -eq 0) {
  Invoke-NativeCommand -FilePath $pgCtl -Arguments @('-D', $script:PostgresData, 'stop', '-m', 'fast')
  Write-Host 'Stopped the isolated project PostgreSQL instance.'
}

Write-Host 'Qiuzheng has stopped.' -ForegroundColor Green
