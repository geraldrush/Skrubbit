@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  Skrubbit - sync this copy with GitHub
echo ============================================
echo.
echo Folder: %cd%

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo.
  echo This folder is not a git repository. Nothing to sync.
  goto :done
)

for /f "delims=" %%i in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%i
echo Branch: %BRANCH%
echo.

rem Uncommitted work here would be fighting whatever is on GitHub, so stop
rem rather than pull on top of it.
set STATUSFILE=%TEMP%\skrubbit_sync_status.txt
git status --porcelain > "%STATUSFILE%"
for %%A in ("%STATUSFILE%") do set SIZE=%%~zA
if not "%SIZE%"=="0" (
  echo You have uncommitted changes in this copy:
  echo.
  type "%STATUSFILE%"
  echo.
  echo Commit and push them, or stash them, before syncing.
  echo Nothing has been changed.
  del "%STATUSFILE%" >nul 2>&1
  goto :done
)
del "%STATUSFILE%" >nul 2>&1

echo Fetching from GitHub...
git fetch origin
if errorlevel 1 (
  echo.
  echo Could not reach GitHub. Check the network, or your SSH key.
  goto :done
)

git pull --ff-only
if errorlevel 1 (
  echo.
  echo Pull refused - this copy has commits GitHub does not have, or the
  echo two have diverged. Push from here first, or sort out the history.
  echo Nothing has been changed.
  goto :done
)

echo.
echo Done. This copy is now at:
git log --oneline -1
echo.
echo Reminder: build and deploy from the WSL copy at /home/gery/skrubbit -
echo building on the D: drive takes 35+ minutes.

:done
echo.
pause
endlocal
