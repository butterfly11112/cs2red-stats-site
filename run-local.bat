@echo off
echo Installing dependencies (first run only takes a minute or two)...
call npm install
if errorlevel 1 goto :error

echo Installing Chromium for Playwright (first run only)...
call npx playwright install chromium
if errorlevel 1 goto :error

echo.
echo Starting server on http://localhost:3000 ...
echo Press Ctrl+C to stop.
node server.js
goto :eof

:error
echo.
echo Something failed above. Scroll up to see the error message.
pause
