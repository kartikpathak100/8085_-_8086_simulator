@echo off
REM Creates a Desktop shortcut that opens the workstation in its own window.
REM Usage: make-shortcut.bat [url]
setlocal
set "URL=%~1"
if "%URL%"=="" set "URL=http://localhost:8085"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0make-shortcut.ps1" -Url "%URL%"
if errorlevel 1 pause
