# Pocketfolio - Startup Script
# Starts Azurite, .NET backend, and Angular frontend

$projectRoot = $PSScriptRoot
$databaseDir = Join-Path $projectRoot "database"

Write-Host ""
Write-Host "  Pocketfolio" -ForegroundColor Cyan
Write-Host ""

# Ensure database folder exists
if (!(Test-Path $databaseDir)) {
    New-Item -ItemType Directory -Path $databaseDir | Out-Null
    Write-Host "  Created database folder." -ForegroundColor Gray
}

# Kill existing processes on ports 10000, 10001, 10002 (Azurite), 5000, 4200
$ports = @(10000, 10001, 10002, 5000, 4200)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($proc -and $proc.Id -ne 0) {
            Write-Host "  Stopping $($proc.ProcessName) (PID $($proc.Id)) on port $port..." -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "  Starting Azurite, backend, and frontend..." -ForegroundColor Gray
Write-Host ""

# Start Azurite in a new terminal (blob storage emulator)
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Write-Host 'Azurite starting (blob: 10000, queue: 10001, table: 10002)' -ForegroundColor Magenta; azurite --silent --skipApiVersionCheck --location '$databaseDir' --debug '$databaseDir\azurite-debug.log'"
)

# Wait briefly for Azurite to start
Start-Sleep -Seconds 2

# Start backend in a new terminal
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$projectRoot\backend'; Write-Host 'Backend starting on http://localhost:5000' -ForegroundColor Green; dotnet run"
)

# Start frontend in a new terminal
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$projectRoot\frontend'; Write-Host 'Frontend starting on http://localhost:4200' -ForegroundColor Green; npx ng serve"
)

Write-Host "  Azurite  -> localhost:10000 (blob), 10001 (queue), 10002 (table)" -ForegroundColor Magenta
Write-Host "  Backend  -> http://localhost:5000" -ForegroundColor Green
Write-Host "  Frontend -> http://localhost:4200" -ForegroundColor Green
Write-Host "  Database -> $databaseDir" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Three terminal windows have been opened." -ForegroundColor Gray
Write-Host "  Close them to stop the servers." -ForegroundColor Gray
Write-Host ""
