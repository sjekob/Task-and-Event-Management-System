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

python main.py
