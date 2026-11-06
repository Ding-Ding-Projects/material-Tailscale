@echo off
setlocal EnableExtensions
rem Builds Material Tailscale from a fresh checkout. Add --run to launch it after a successful build.
rem Usage: build.bat [--run] [/s ^| --silent]   (or set SILENT=1)
cd /d "%~dp0"
set "RUN="
set "SIL="
for %%a in (%*) do (
  if /i "%%~a"=="--run" set "RUN=1"
  if /i "%%~a"=="/s" set "SIL=/s"
  if /i "%%~a"=="--silent" set "SIL=/s"
)
if "%SILENT%"=="1" set "SIL=/s"
echo [1/3] Dependencies
call download-dependencies.bat %SIL%
if errorlevel 1 exit /b %errorlevel%
echo [2/3] Icons and build
call npm run icons
if errorlevel 1 ( echo FAILED: icons & exit /b 1 )
call npm run build
if errorlevel 1 ( echo FAILED: build & exit /b 1 )
echo [3/3] Checks
call npm test
if errorlevel 1 ( echo FAILED: tests & exit /b 1 )
if defined RUN (
  echo Launching Material Tailscale
  call npx electron .
  exit /b %errorlevel%
)
echo Build finished. Run "build.bat --run" to launch.
exit /b 0
