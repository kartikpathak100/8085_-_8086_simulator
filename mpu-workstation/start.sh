#!/usr/bin/env sh
# One-command launcher. Uses Docker when it is available, otherwise Node.
set -e

PORT="${PORT:-8085}"
IMAGE="mpu-workstation:1.0.0"

open_browser() {
  url="$1"
  if   command -v xdg-open >/dev/null 2>&1; then xdg-open "$url" >/dev/null 2>&1 || true
  elif command -v open     >/dev/null 2>&1; then open "$url"     >/dev/null 2>&1 || true
  fi
}

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "Docker found — building the image (first run takes a couple of minutes)..."
  if docker compose version >/dev/null 2>&1; then
    docker compose up -d --build
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose up -d --build
  else
    docker build -t "$IMAGE" .
    docker rm -f mpu-workstation >/dev/null 2>&1 || true
    docker run -d --name mpu-workstation -p "${PORT}:80" --restart unless-stopped "$IMAGE"
  fi
  echo ""
  echo "  MPU Workstation is running at http://localhost:${PORT}"
  echo "  Stop it with:  docker compose down    (or: docker rm -f mpu-workstation)"
  echo "  Want it on your desktop?  ./scripts/make-shortcut.sh"
  open_browser "http://localhost:${PORT}"
  exit 0
fi

if command -v node >/dev/null 2>&1; then
  echo "Docker is not available — falling back to a local Node build."
  npm install
  npm run build
  echo ""
  echo "  Serving the built app at http://localhost:4173"
  open_browser "http://localhost:4173"
  npm run preview
  exit 0
fi

echo "Neither Docker nor Node.js was found."
echo "Install Docker Desktop (docker.com/get-started) or Node 18+ (nodejs.org) and run this script again."
exit 1
