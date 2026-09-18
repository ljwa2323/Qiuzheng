. (Join-Path $PSScriptRoot 'windows-common.ps1')

$rows = @(
  [pscustomobject]@{
    Service = 'Web'
    Address = "http://localhost:$($script:WebPort)"
    Status = if (Test-HttpEndpoint -Uri "http://127.0.0.1:$($script:WebPort)") { 'ready' } else { 'stopped' }
  },
  [pscustomobject]@{
    Service = 'API'
    Address = "http://localhost:$($script:ApiPort)/health"
    Status = if (Test-HttpEndpoint -Uri "http://127.0.0.1:$($script:ApiPort)/health") { 'ready' } else { 'stopped' }
  },
  [pscustomobject]@{
    Service = 'PostgreSQL (project)'
    Address = "127.0.0.1:$($script:PostgresPort)"
    Status = if (Test-TcpPort -HostName '127.0.0.1' -Port $script:PostgresPort) { 'ready' } else { 'stopped' }
  },
  [pscustomobject]@{
    Service = 'Redis/Memurai'
    Address = '127.0.0.1:6379'
    Status = if (Test-TcpPort -HostName '127.0.0.1' -Port 6379) { 'ready' } else { 'stopped' }
  }
)

$rows | Format-Table -AutoSize

