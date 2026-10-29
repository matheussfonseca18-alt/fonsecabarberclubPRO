@echo off
cd /d "%~dp0"
node "%~dp0start-preview.mjs"
if errorlevel 1 pause
