@echo off
echo Setting PATH...
set PATH=C:\Users\Administrator\.cargo\bin;%PATH%

echo Verifying Cargo...
cargo --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Cargo not found
    exit /b 1
)

echo.
echo Starting Tauri Build...
cd frontend
npm run tauri:build

cd ..
echo.
echo Done!
pause
