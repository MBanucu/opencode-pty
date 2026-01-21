#!/bin/bash

# Quick setup script for local opencode-pty development
# Usage: ./setup-local.sh /path/to/opencode/project

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 /path/to/opencode/project"
    echo "Example: $0 ~/my-project"
    exit 1
fi

PROJECT_DIR="$1"
PLUGIN_SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Setting up opencode-pty for local development..."
echo "Project directory: $PROJECT_DIR"
echo "Plugin source: $PLUGIN_SRC_DIR"
echo ""

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo "Error: Project directory $PROJECT_DIR does not exist"
    exit 1
fi

# Create .opencode/plugins directory if it doesn't exist
mkdir -p "$PROJECT_DIR/.opencode/plugins"

# Create symlink to plugin
PLUGIN_LINK="$PROJECT_DIR/.opencode/plugins/opencode-pty"
if [ -L "$PLUGIN_LINK" ]; then
    echo "Removing existing symlink..."
    rm "$PLUGIN_LINK"
fi

echo "Creating symlink to plugin..."
ln -s "$PLUGIN_SRC_DIR" "$PLUGIN_LINK"

# Install dependencies
echo "Installing plugin dependencies..."
cd "$PLUGIN_SRC_DIR"
bun install

# Check if opencode.json exists, create example if not
if [ ! -f "$PROJECT_DIR/opencode.json" ]; then
    echo "Creating example opencode.json..."
    cat > "$PROJECT_DIR/opencode.json" << 'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-3-5-sonnet-20241022",
  "plugin": [
    "opencode-pty"
  ],
  "permission": {
    "bash": {
      "*": "allow",
      "rm *": "ask",
      "rm -rf *": "deny"
    },
    "read": {
      "*": "allow",
      ".env*": "deny"
    },
    "edit": "allow",
    "glob": "allow"
  }
}
EOF
    echo "Created $PROJECT_DIR/opencode.json"
    echo "Note: Update the model configuration with your actual API keys"
else
    echo "opencode.json already exists. You may need to add the plugin manually:"
    echo "  \"plugin\": [\"opencode-pty\"]"
fi

echo ""
echo "Setup complete! 🎉"
echo ""
echo "Next steps:"
echo "1. cd $PROJECT_DIR"
echo "2. opencode"
echo "3. The plugin should load automatically"
echo "4. Open http://localhost:8765 in your browser"
echo ""
echo "For development:"
echo "- Make changes in $PLUGIN_SRC_DIR"
echo "- Restart OpenCode to reload the plugin"
echo "- Run 'bun test' in $PLUGIN_SRC_DIR to test changes"