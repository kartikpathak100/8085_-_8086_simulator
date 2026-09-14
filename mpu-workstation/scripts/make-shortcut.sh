#!/usr/bin/env sh
# Creates a desktop shortcut that opens the workstation in its own window.
#
#   ./scripts/make-shortcut.sh              # uses http://localhost:8085
#   ./scripts/make-shortcut.sh http://host:9000
set -e

URL="${1:-http://localhost:8085}"
NAME="MPU Workstation"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ICON_PNG="$HERE/public/icon-512.png"

find_browser() {
  for b in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge brave-browser vivaldi; do
    if command -v "$b" >/dev/null 2>&1; then echo "$b"; return; fi
  done
  echo ""
}

case "$(uname -s)" in
  Darwin)
    APP="$HOME/Applications/$NAME.app"
    mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
    cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>$NAME</string>
  <key>CFBundleIdentifier</key><string>io.mpu.workstation</string>
  <key>CFBundleExecutable</key><string>run</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0.0</string>
</dict></plist>
PLIST
    cat > "$APP/Contents/MacOS/run" <<RUN
#!/bin/sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
EDGE="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
if [ -x "\$CHROME" ]; then exec "\$CHROME" --app="$URL"
elif [ -x "\$EDGE" ]; then exec "\$EDGE" --app="$URL"
else exec open "$URL"; fi
RUN
    chmod +x "$APP/Contents/MacOS/run"
    if command -v sips >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1; then
      TMP="$(mktemp -d)/icon.iconset"; mkdir -p "$TMP"
      for s in 16 32 64 128 256 512; do
        sips -z $s $s "$ICON_PNG" --out "$TMP/icon_${s}x${s}.png" >/dev/null 2>&1 || true
      done
      iconutil -c icns "$TMP" -o "$APP/Contents/Resources/icon.icns" >/dev/null 2>&1 || true
    fi
    ln -sf "$APP" "$HOME/Desktop/$NAME.app" 2>/dev/null || true
    echo "Created $APP (and a link on your Desktop) pointing at $URL"
    ;;

  Linux)
    BROWSER="$(find_browser)"
    if [ -n "$BROWSER" ]; then EXEC="$BROWSER --app=$URL"; else EXEC="xdg-open $URL"; fi
    DESKTOP_FILE="$HOME/.local/share/applications/mpu-workstation.desktop"
    mkdir -p "$(dirname "$DESKTOP_FILE")"
    cat > "$DESKTOP_FILE" <<ENTRY
[Desktop Entry]
Type=Application
Name=$NAME
Comment=8085 / 8086 microprocessor workstation
Exec=$EXEC
Icon=$ICON_PNG
Terminal=false
Categories=Development;Education;
StartupWMClass=$NAME
ENTRY
    chmod +x "$DESKTOP_FILE"
    if [ -d "$HOME/Desktop" ]; then
      cp "$DESKTOP_FILE" "$HOME/Desktop/mpu-workstation.desktop"
      chmod +x "$HOME/Desktop/mpu-workstation.desktop"
      gio set "$HOME/Desktop/mpu-workstation.desktop" metadata::trusted true 2>/dev/null || true
    fi
    command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    echo "Created $DESKTOP_FILE pointing at $URL"
    echo "If the desktop icon shows a padlock, right-click it and choose 'Allow launching'."
    ;;

  *)
    echo "This script handles macOS and Linux. On Windows run scripts\\make-shortcut.bat instead."
    exit 1
    ;;
esac
