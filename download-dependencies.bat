@echo off
setlocal EnableExtensions
rem Fetches every dependency needed to build, run and test Material Tailscale.
rem Usage: download-dependencies.bat [/s ^| --silent]   (or set SILENT=1)
set "QUIET="
if /i "%~1"=="/s" set "QUIET=1"
if /i "%~1"=="--silent" set "QUIET=1"
if "%SILENT%"=="1" set "QUIET=1"
cd /d "%~dp0"

echo [1/3] Checking Node.js 22
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Installing Node.js LTS for this user with winget...
  winget install --id OpenJS.NodeJS.LTS --scope user --silent --accept-package-agreements --accept-source-agreements
  if errorlevel 1 ( echo FAILED: could not install Node.js. Install Node.js 22 from https://nodejs.org and run again. & exit /b 1 )
  set "PATH=%LOCALAPPDATA%\Programs\nodejs;%ProgramFiles%\nodejs;%PATH%"
)
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODEMAJOR=%%v
if %NODEMAJOR% LSS 20 ( echo FAILED: Node.js 20 or newer is required, found %NODEMAJOR%. & exit /b 1 )

echo [2/3] Installing pinned npm packages from package-lock.json
call npm ci --no-audit --no-fund
if errorlevel 1 ( echo FAILED: npm ci & exit /b 1 )

echo [3/3] Verifying Electron download
node -e "require('electron')" >nul 2>nul
if errorlevel 1 ( echo FAILED: Electron is missing after install & exit /b 1 )
echo Dependencies are ready.
exit /b 0
