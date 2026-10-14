@echo off
title TaskNet

echo.
echo  ===================================================
echo   TaskNet - Starting Backend
echo  ===================================================
echo.

cd /d "%~dp0backend"

REM Create virtual environment if it doesn't exist
if not exist "venv\Scripts\activate.bat" (
    echo  [1/3] Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo  [2/3] Activating virtual environment...
call venv\Scripts\activate.bat

REM Install / update dependencies
echo  [3/3] Installing dependencies...
pip install -r requirements.txt -q

echo.
echo  ===================================================
echo   TaskNet API is starting...
echo.
echo    API:   http://localhost:8000
echo    Docs:  http://localhost:8000/docs
echo.
echo   Default accounts:
echo    admin        / admin123   (Admin)
echo    principal    / prin123    (Principal)
echo    coordinator  / coord123   (Coordinator)
echo    teacher1     / teach123   (Teacher)
echo.
echo   Press Ctrl+C to stop
echo  ===================================================
echo.

REM PostgreSQL: uses DATABASE_URL when set; otherwise runs Postgres in Docker on :5432.
if defined DATABASE_URL goto :run
echo  Starting PostgreSQL (Docker)...
docker start tasknet_postgres >nul 2>&1 || docker run -d --name tasknet_postgres -e POSTGRES_USER=tasknet -e POSTGRES_PASSWORD=tasknet -e POSTGRES_DB=tasknet -p 5432:5432 -v tasknet_pgdata:/var/lib/postgresql/data postgres:16-alpine >nul
for /l %%i in (1,1,30) do (
    docker exec tasknet_postgres pg_isready -U tasknet >nul 2>&1 && goto :pg_ready
    timeout /t 1 /nobreak >nul
)
:pg_ready
set "DATABASE_URL=postgresql://tasknet:tasknet@localhost:5432/tasknet"

:run
python main.py
