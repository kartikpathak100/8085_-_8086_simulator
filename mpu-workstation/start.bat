@echo off
setlocal
set PORT=8085
set IMAGE=mpu-workstation:1.0.0

where docker >nul 2>&1
if %errorlevel%==0 (
  docker info >nul 2>&1
  if %errorlevel%==0 (
    echo Docker found - building the image, this takes a couple of minutes the first time...
    docker compose up -d --build
    if errorlevel 1 (
      docker build -t %IMAGE% .
      docker rm -f mpu-workstation >nul 2>&1
      docker run -d --name mpu-workstation -p %PORT%:80 --restart unless-stopped %IMAGE%
    )
    echo.
    echo   MPU Workstation is running at http://localhost:%PORT%
    echo   Stop it with: docker compose down
    echo   Want it on your desktop?  scripts\make-shortcut.bat
    start "" http://localhost:%PORT%
    goto :eof
  )
)

where node >nul 2>&1
if %errorlevel%==0 (
  echo Docker is not available - falling back to a local Node build.
  call npm install
  call npm run build
  start "" http://localhost:4173
  call npm run preview
  goto :eof
)

echo Neither Docker nor Node.js was found.
echo Install Docker Desktop (docker.com/get-started) or Node 18+ (nodejs.org), then run this again.
pause
