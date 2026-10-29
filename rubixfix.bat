@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set PORT=5210

if "%~1"=="" goto menu
for %%c in (start stop restart test build status clean) do if /i "%~1"=="%%c" goto %%c
goto usage

:menu
cls
echo ==========================================
echo   RUBIXFIX  -  control panel
echo ==========================================
echo   1  start    build + serve on localhost + open browser
echo   2  stop     stop the server
echo   3  restart  stop then start
echo   4  build    rebuild dist\index.html
echo   5  test     run solver tests
echo   6  status   what is running
echo   7  clean    delete dist\
echo   0  quit
echo ==========================================
choice /c 12345670 /n /m "Pick: "
set SEL=%errorlevel%
if %SEL%==1 call :start
if %SEL%==2 call :stop
if %SEL%==3 call :restart
if %SEL%==4 call :build
if %SEL%==5 call :test
if %SEL%==6 call :status
if %SEL%==7 call :clean
if %SEL%==8 exit /b 0
echo.
pause
goto menu

:usage
echo Usage: rubixfix.bat [start^|stop^|restart^|build^|test^|status^|clean]
echo        (no argument opens the menu)
exit /b 1

:start
call :build || exit /b 1
call :port_pid %PORT%
if defined PID (
  echo Server already running on port %PORT% ^(PID %PID%^).
) else (
  echo Starting server on http://localhost:%PORT% ...
  start "RubixFix Server" /min cmd /c node serve.mjs %PORT%
  timeout /t 2 /nobreak >nul
)
start "" http://localhost:%PORT%
exit /b 0

:stop
call :port_pid %PORT%
if defined PID (
  echo Stopping server on port %PORT% ^(PID !PID!^)
  taskkill /PID !PID! /F /T >nul 2>&1
) else (
  echo Nothing was running.
)
exit /b 0

:restart
call :stop
call :start
exit /b 0

:build
call node build.mjs
exit /b %errorlevel%

:test
call node test.mjs
exit /b %errorlevel%

:status
call :port_pid %PORT%
if defined PID ( echo Port %PORT% : RUNNING ^(PID !PID!^) ) else ( echo Port %PORT% : stopped )
exit /b 0

:clean
if exist dist rmdir /s /q dist
echo dist\ removed.
exit /b 0

:: sets PID to the process listening on the given port (empty if none)
:port_pid
set PID=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":%1 .*LISTENING"') do set PID=%%a
exit /b 0
