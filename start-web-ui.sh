#!/usr/bin/env bash

# Start the PTY web UI server
# This should be run alongside OpenCode

echo "Starting PTY Web UI Server..."
echo "Make sure OpenCode is running with the PTY plugin loaded"
echo "Web UI will be available at: http://localhost:8765"
echo ""

cd "$(dirname "${BASH_SOURCE[0]}")"
bun run test-web-server.ts