# TaskNet Startup Script (PowerShell)
# Run from project root: .\start.ps1

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"

Write-Host ""
Write-Host " ===================================================" -ForegroundColor Cyan
Write-Host "  TaskNet - Starting Backend" -ForegroundColor Cyan
Write-Host " ===================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $BackendDir

# Create virtual environment if needed
if (-not (Test-Path "venv\Scripts\Activate.ps1")) {
    Write-Host " [1/3] Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate
Write-Host " [2/3] Activating virtual environment..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"

# Install dependencies
Write-Host " [3/3] Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt -q

Write-Host ""
Write-Host " ===================================================" -ForegroundColor Green
Write-Host "  TaskNet API is starting..." -ForegroundColor Green
Write-Host ""
Write-Host "   API:   http://localhost:8000" -ForegroundColor White
Write-Host "   Docs:  http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "  Default accounts:" -ForegroundColor White
Write-Host "   admin        / admin123   (Admin)" -ForegroundColor Gray
Write-Host "   principal    / prin123    (Principal)" -ForegroundColor Gray
Write-Host "   coordinator  / coord123   (Coordinator)" -ForegroundColor Gray
Write-Host "   teacher1     / teach123   (Teacher)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host " ===================================================" -ForegroundColor Green
Write-Host ""

python main.py
