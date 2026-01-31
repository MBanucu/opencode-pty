# Quickstart

## For Users (Install / Upgrade)

- Add `opencode-pty` to your OpenCode config in the `plugin` array:
  ```json
  {
    "$schema": "https://opencode.ai/config.json",
    "plugin": ["opencode-pty"]
  }
  ```
- To force an upgrade or clear a corrupted cache:
  ```sh
  rm -rf ~/.cache/opencode/node_modules/opencode-pty # then rerun opencode
  ```
- OpenCode will install/update plugins on the next run; plugins are not auto-updated.

## For Plugin/Agent Developers (Local Plugins)

- Place TypeScript or JavaScript plugins in `.opencode/plugins/` in your project root.
- For dependencies, include a minimal `.opencode/package.json` (see appendix in index.md).
- No extra config is required for plugins in this directory — just restart OpenCode to reload any changes.
- **If you add dependencies:** Run `bun install` in `.opencode/`. Restart OpenCode to reload new modules.
- For multi-file or build-step plugins, output built files to `.opencode/plugins/`.

## Running the Web UI (PTY sessions)

- Start the PTY Web UI in dev mode:
  ```sh
  bun run e2e/test-web-server.ts
  ```
- Open http://localhost:8766 in your browser (shows session management, streaming, and toolkit features).
