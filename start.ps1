# TaskNet — Microservices Startup Script (PowerShell)
# Run from project root: .\start.ps1
#
# Starts all backend microservices plus the API gateway.
# The frontend still points to http://localhost:8000 (gateway).
#
# Service map:
#   :8000  gateway    — API Gateway (all traffic enters here)
#   :8001  auth       — Authentication, users, grade-levels
#   :8002  personnel  — Personnel management
#   :8003  tasks      — Tasks, templates, reports, comments
#   :8004  events     — Event calendar
#   :8005  appraisal  — Appraisal & dashboard

$Root       = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"
$Venv       = Join-Path $BackendDir "venv"
$Uvicorn    = Join-Path $Venv "Scripts\uvicorn.exe"

Write-Host ""
Write-Host " ===================================================" -ForegroundColor Cyan
Write-Host "  TaskNet — Microservices Backend" -ForegroundColor Cyan
Write-Host " ===================================================" -ForegroundColor Cyan
Write-Host ""

# ── Ensure venv exists ────────────────────────────────────────────────────────
if (-not (Test-Path (Join-Path $Venv "Scripts\pip.exe"))) {
    Write-Host " [setup] Creating virtual environment..." -ForegroundColor Yellow
    Set-Location $BackendDir
    python -m venv venv
}

# ── Install / update dependencies ─────────────────────────────────────────────
Write-Host " [setup] Installing dependencies..." -ForegroundColor Yellow
& (Join-Path $Venv "Scripts\pip.exe") install -r (Join-Path $BackendDir "requirements.txt") -q

# ── Helper: launch a service in a new window ─────────────────────────────────
function Start-Service {
    param(
        [string]$Name,
        [string]$Module,
        [int]   $Port
    )
    $title = "TaskNet :: $Name (:$Port)"
    $cmd   = "Set-Location '$BackendDir'; & '$Uvicorn' $Module`:app --host 0.0.0.0 --port $Port --reload"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd `
        -WindowStyle Normal
    Write-Host "  started  $Name  →  http://localhost:$Port  (docs: http://localhost:$Port/docs)" -ForegroundColor Green
}

Write-Host ""
Write-Host " Starting services..." -ForegroundColor Cyan
Write-Host ""

Start-Service -Name "Auth Service"       -Module "services.auth.main"       -Port 8001
Start-Sleep -Milliseconds 400
Start-Service -Name "Personnel Service"  -Module "services.personnel.main"  -Port 8002
Start-Sleep -Milliseconds 400
Start-Service -Name "Tasks Service"      -Module "services.tasks.main"      -Port 8003
Start-Sleep -Milliseconds 400
Start-Service -Name "Events Service"     -Module "services.events.main"     -Port 8004
Start-Sleep -Milliseconds 400
Start-Service -Name "Appraisal Service"  -Module "services.appraisal.main"  -Port 8005
Start-Sleep -Milliseconds 600

# Gateway starts last so services are ready
Start-Service -Name "API Gateway"        -Module "gateway.main"              -Port 8000

Write-Host ""
Write-Host " ===================================================" -ForegroundColor Green
Write-Host "  All services started." -ForegroundColor Green
Write-Host ""
Write-Host "   Frontend points to:  http://localhost:8000" -ForegroundColor White
Write-Host "   Gateway health:       http://localhost:8000/health" -ForegroundColor White
Write-Host "   Gateway docs:         http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "  Individual service docs:" -ForegroundColor White
Write-Host "   Auth       http://localhost:8001/docs" -ForegroundColor Gray
Write-Host "   Personnel  http://localhost:8002/docs" -ForegroundColor Gray
Write-Host "   Tasks      http://localhost:8003/docs" -ForegroundColor Gray
Write-Host "   Events     http://localhost:8004/docs" -ForegroundColor Gray
Write-Host "   Appraisal  http://localhost:8005/docs" -ForegroundColor Gray
Write-Host ""
Write-Host "  Default accounts:" -ForegroundColor White
Write-Host "   admin        / admin123" -ForegroundColor Gray
Write-Host "   principal    / prin123" -ForegroundColor Gray
Write-Host "   coordinator  / coord123" -ForegroundColor Gray
Write-Host "   teacher1     / teach123" -ForegroundColor Gray
Write-Host ""
Write-Host "  Close individual service windows to stop them." -ForegroundColor Yellow
Write-Host " ===================================================" -ForegroundColor Green
Write-Host ""
