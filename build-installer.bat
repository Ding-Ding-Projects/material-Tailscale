@echo off
setlocal EnableExtensions
rem Builds the release-equivalent Squirrel.Windows installer into out\installer.
rem Usage: build-installer.bat [/s ^| --silent]   (or set SILENT=1)
cd /d "%~dp0"
call build.bat %*
if errorlevel 1 exit /b %errorlevel%
echo Packaging the Squirrel.Windows installer (unsigned)
call npm run package:win
if errorlevel 1 ( echo FAILED: packaging & exit /b 1 )
echo Installer: out\installer\MaterialTailscaleSetup.exe
exit /b 0
