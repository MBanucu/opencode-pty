# OpenCode Plugin Loading Guide

This guide explains how to properly load plugins in OpenCode, distinguishing between npm packages and local plugins.

## Plugin Loading Methods

### 1. NPM Packages (via opencode.json)

For published plugins available on npm:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-helicone-session", "opencode-wakatime"]
}
```

- Listed in the `plugin` array
- Automatically downloaded and installed by OpenCode
- Dependencies managed by OpenCode

### 2. Local Plugins (via directory structure)

For local development or unpublished plugins:

```
.opencode/plugins/          # Project-level plugins
├── my-plugin.js           # Individual files
├── another-plugin.ts
└── opencode-pty/          # Plugin directories
    ├── index.ts
    ├── package.json       # Optional, for dependencies
    └── src/

~/.config/opencode/plugins/ # Global-level plugins
├── global-plugin.js
```

- **No config entry needed** in `opencode.json`
- Placed directly in plugin directories
- Loaded automatically on startup
- Can include `package.json` for dependencies

## PTY Plugin Setup

The opencode-pty plugin is set up as a **local plugin**:

1. **Location**: `.opencode/plugins/opencode-pty/`
2. **Loading**: Automatic (no config entry needed)
3. **Dependencies**: Managed via plugin's `package.json`

## Configuration

For the PTY plugin demo:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode/grok-code",
  "permission": {
    "bash": {
      "*": "allow",
      "rm *": "ask",
      "rm -rf *": "deny"
    }
  }
}
```

Note: No `plugin` field needed for local plugins.

## Development Workflow

- Make changes in `.opencode/plugins/opencode-pty/`
- Restart OpenCode to reload the plugin
- Run tests: `cd .opencode/plugins/opencode-pty && bun test`

## Key Differences

| Aspect | NPM Plugins | Local Plugins |
|--------|-------------|---------------|
| Config | `"plugin": ["name"]` | None required |
| Location | Auto-downloaded | `.opencode/plugins/` |
| Dependencies | Auto-managed | Manual via package.json |
| Updates | Via npm versions | Manual file updates |
| Development | Publish to npm first | Direct file editing |

## Why This Approach

The PTY plugin uses local loading because:
- Enables rapid development iteration
- Avoids npm publishing during development
- Allows for custom modifications
- Works offline without npm registry access