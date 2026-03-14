#!/usr/bin/env bash
# ============================================================
#  CATBUS Setup Installer — Mac/Linux Launcher
#  Usage:
#    bash setup/run-setup.sh
#  Or make executable and run directly:
#    chmod +x setup/run-setup.sh && ./setup/run-setup.sh
# ============================================================

set -e

echo ""
echo "============================================================"
echo "  CATBUS Setup Installer"
echo "============================================================"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js is not installed or not on PATH."
    echo ""
    echo "Install Node.js from: https://nodejs.org/"
    echo "Or via Homebrew (Mac): brew install node"
    exit 1
fi

# Move to repo root (one directory up from setup/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

# Run the setup wizard
node setup/setup.js
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -ne 0 ]; then
    echo "Setup exited with errors. See the output above for details."
else
    echo "Setup complete!"
fi

exit $EXIT_CODE
