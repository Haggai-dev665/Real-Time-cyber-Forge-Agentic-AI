#!/usr/bin/env bash
# CyberForge - macOS / Linux uninstaller / data purge.
#
# Removes the CyberForge app, the per-user DATA directory and the PATH export
# the app added. The OS package manager (apt/dnf for .deb/.rpm) removes the
# binary; for .AppImage / .app you just delete the file - this script also
# cleans the data + PATH that those leave behind.
#
#   ./scripts/uninstall.sh            # interactive
#   ./scripts/uninstall.sh --force    # no prompts
#   ./scripts/uninstall.sh --keep-data
set -euo pipefail

FORCE=0; KEEP_DATA=0
for a in "$@"; do
  case "$a" in
    --force) FORCE=1 ;;
    --keep-data) KEEP_DATA=1 ;;
  esac
done

OS="$(uname -s)"
if [ "$OS" = "Darwin" ]; then
  DATA_DIR="$HOME/Library/Application Support/com.cyberforge.console"
  INSTALL_DIR="$HOME/Applications/CyberForge"
  APP_BUNDLE="/Applications/CyberForge.app"
  PROFILE="$HOME/.zprofile"
else
  DATA_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/com.cyberforge.console"
  INSTALL_DIR="$HOME/.local/share/CyberForge"
  APP_BUNDLE=""
  PROFILE="$HOME/.profile"
fi
BIN_DIR="$INSTALL_DIR/bin"

confirm() { # confirm "message"
  [ "$FORCE" = "1" ] && return 0
  read -r -p "$1 [y/N] " ans
  [ "$ans" = "y" ] || [ "$ans" = "Y" ]
}

echo "CyberForge uninstaller"
echo "  Data directory : $DATA_DIR"
echo "  Install dir    : $INSTALL_DIR"
echo

# 1) Stop a running instance.
pkill -f 'CyberForge' 2>/dev/null || true
pkill -f 'cyberforge-console' 2>/dev/null || true

# 2) Remove the PATH export line the installer appended.
if [ -f "$PROFILE" ] && grep -q "$BIN_DIR" "$PROFILE" 2>/dev/null; then
  tmp="$(mktemp)"
  grep -v "$BIN_DIR" "$PROFILE" > "$tmp" && mv "$tmp" "$PROFILE"
  echo "Removed PATH export from $PROFILE"
fi

# 3) Remove the installed app.
if [ -n "$APP_BUNDLE" ] && [ -d "$APP_BUNDLE" ]; then
  confirm "Remove app bundle $APP_BUNDLE?" && rm -rf "$APP_BUNDLE" && echo "Removed $APP_BUNDLE"
fi
if [ -d "$INSTALL_DIR" ]; then
  confirm "Remove install directory $INSTALL_DIR?" && rm -rf "$INSTALL_DIR" && echo "Removed $INSTALL_DIR"
fi
if [ "$OS" != "Darwin" ]; then
  echo "If installed from .deb/.rpm, also run:  sudo apt remove cyberforge   (or)  sudo dnf remove cyberforge"
fi

# 4) Purge per-user data.
if [ "$KEEP_DATA" = "1" ]; then
  echo "Keeping data directory: $DATA_DIR"
elif [ -d "$DATA_DIR" ]; then
  if confirm "Delete all CyberForge data (scans, memory, blocklists, token) in $DATA_DIR?"; then
    rm -rf "$DATA_DIR"
    echo "Removed data directory."
  fi
fi

echo
echo "Done."
