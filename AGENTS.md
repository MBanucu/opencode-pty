# AGENTS.md

This document provides essential instructions for agentic coding assistants and developers working with this repository. It contains codebase conventions, installation paths, PTY lifecycle, permission caveats, troubleshooting, and guidelines specific to plugin and agent workflow.

## Project Overview

**opencode-pty** is an OpenCode/Bun plugin for interactive PTY (pseudo-terminal) management. It enables multiple concurrent shell sessions, sending/receiving input/output, regex filtering, output buffering, exit code/status monitoring, and permission-aware process handling. The system supports direct programmatic (API/tool) access and a modern React-based web UI with real-time streaming and interaction.

---

## Installation / Loading

### NPM Installation

- For production or standard user installs, add to the OpenCode config’s `plugin` array:
  ```json
  {
    "$schema": "https://opencode.ai/config.json",
    "plugin": ["opencode-pty"]
  }
  ```
- OpenCode will install/update the plugin on next run. **Note:** OpenCode does NOT auto-update plugins—clear cache (`rm -rf ~/.cache/opencode/node_modules/opencode-pty`) and rerun as needed to fetch new versions.

### Local Plugin Development

- For development and agent authoring, modify `.opencode/plugins/` directly:
  - Place TypeScript or JavaScript files in `.opencode/plugins/`.
  - Include a minimal `.opencode/package.json` for local dependencies:
    ```json
    {
      "name": "my-opencode-plugins",
      "private": true,
      "dependencies": { "@opencode-ai/plugin": "^1.x" }
    }
    ```
  - No config entry is required for local plugins—they are loaded automatically by placement.
  - After editing local plugins, **restart OpenCode** to see changes. Use `bun install` in the .opencode directory for new dependencies.
  - For multi-file or build-step plugins, output built files to `.opencode/plugins/`.

---

## Core Commands: Build, Lint, Test

- **Typecheck TypeScript:** `bun run typecheck` (strict, no emit)
- **Unit testing:** `bun test` (Bun’s test runner, excludes e2e/web)
- **Single test:** `bun test --match "<pattern>"`
- **E2E web UI tests:** `bun run test:e2e` (Playwright; validates session creation, streaming, web interaction)
- **Linting:** `bun run lint` (ESLint with Prettier integration; `lint:fix` for auto-fixes)
- **Formatting:** `bun run format`, check with `format:check`
- **Aggregate checks:** `bun run quality` (lint, format check, typecheck), `bun run ci` (quality + all tests)

---

## Project Structure & Style

- **Source Layout:**
  - `src/plugin/pty/{types, manager, buffer, permissions, wildcard, tools/}` — core code, types, and PTY management tools
  - `src/web/` — React UI components, server, session listing/interactivity
  - Test files in `test/` and `e2e/`
- **File and Code Style:**
  - TypeScript 5.x (strict mode; all strict flags enabled)
  - Use ESNext, explicit `.ts` extensions, relative imports, and verbatim module syntax
  - Prefer camelCase for vars/functions, PascalCase for types/classes/enums, UPPER_CASE for constants
  - Kebab-case for directories, camelCase for most files
  - Organize imports: external first, then internal; types explicit: `import type ...`
  - Always use arrow functions for tools, regular for general utilities; all async I/O should use async/await
  - Use `createLogger` (`src/plugin/logger.ts`) for logging, not ad-hoc prints
- **ESLint + Prettier enforced** at error-level; use Prettier for formatting. Key TS/ES rules:
  - No wildcard imports, no untyped functions, descriptive variables over abbreviations

---

## Plugin/Agent Tool Usage

| Tool        | Description                                     |
| ----------- | ----------------------------------------------- |
| `pty_spawn` | Start PTY (command, args, workdir, env, title)  |
| `pty_write` | Send input (text or escape sequences e.g. \x03) |
| `pty_read`  | Read output buffer, with optional regex filter  |
| `pty_list`  | List all PTY sessions, status, PIDs, line count |
| `pty_kill`  | End session and optionally clean output buffer  |

- Use each tool as a pure function (side effects handled by manager singleton).
- PTY session IDs are unique (crypto-generated) and must be used for all follow-up tool calls.
- **Exiting or killing a session does NOT remove it from the listing/buffer unless `cleanup=true` is passed to `pty_kill`.**
- The buffer stores **up to PTY_MAX_BUFFER_LINES (default 50,000 lines)**, oldest lines are dropped when full.
- To poll/tail, use `limit` and `offset` with `pty_read`.

---

## Web UI & REST/WebSocket API

- **Run web UI:** `bun run test-web-server.ts`
  - Opens test UI at `http://localhost:8766`
  - Demonstrates session management, input capture, real-time streaming
- **Endpoints:**
  - REST: `/api/sessions`, `/api/sessions/:id`, `/api/sessions/:id/output`, `/health`
  - WebSocket: `/ws` for updates and streaming
- **Web UI features:** Session list, live output, interactive input, session kill, connection indicator
  - Real xterm.js for accurate ANSI emulation/interaction

---

## Permissions & Security

- **Permission integration:** All PTY commands are checked via OpenCode’s `permission.bash` config
- **Critical edge cases:**
  - "ask" permission entries are **treated as deny** (plugin/agent cannot prompt)
  - For working directories outside the project, `permission.external_directory` set to "ask" is **treated as allow**
    - To block PTY access to external dirs, set permission explicitly to deny
  - Commands/dirs not covered are denied by default; all denials surface as logs/warnings
  - Always validate/escape user input, especially regex in tool calls
- **Secrets:** Never log sensitive info (refer to `.env` usage only as needed); default environment uses `.envrc` for Nix flakes if present

---

## Buffer & Session Lifecycle

- **Sessions remain after exit** for agent log review; explicitly call `pty_kill` with cleanup to remove
- **Session lifecycle:**
  - `spawn` → `running` → [`exited` | `killed`] (remains listed until cleaned)
  - Check exit code and output buffer after exit; compare logs across multiple runs using persistent session IDs
- **Buffer management:** 2k character limit per line, up to 50k lines (see env var `PTY_MAX_BUFFER_LINES`)

---

## Plugin Authoring & Contributing

- Use plain .ts or .js in `.opencode/plugins/` for quick plugins; use build and outDir for complex plugins
- Always export a valid `plugin` object; see plugin API docs for all hooks/tools
- **Common mistakes to avoid:**
  - Missing `.opencode/package.json` (leads to dependency failures)
  - Not exporting correct plugin shape (plugin ignored silently)
  - Not restarting after file changes
  - Using `import ... from "npm:..."` without `.opencode/package.json`

---

## Testing & Quality

- Write tests for all public agent-facing APIs (unit and e2e)
- Test error conditions and edge cases (invalid regex, permissions, session not found, denied commands)
- Use Bun's test framework for unit, Playwright for e2e; run all with `bun run ci`
- Mock external dependencies if needed for agent test stability

---

## Troubleshooting & Edge Cases

- **Permission denied:** Check your `permission.bash` config
- **Session not found:** Use `pty_list` to discover session IDs
- **Invalid regex in read:** Pre-test regexes, use user-friendly errors/explanations
- **Web UI not launching:** Ensure you ran the correct dev command; see port/URL above
- **Plugin not loading:** Check export signatures, restarts, presence of `.opencode/package.json`, and logs for errors
- **Type errors:** Fix using `bun run typecheck`
- **Test fails:** Diagnose by running test directly with `--match` and reading error/log output

---

## Commit/Branch Workflow

- Use feature branches for changes
- Typecheck and test before committing
- Follow conventional commit format (`feat:`, `fix:`, `refactor:`, etc.)
- DO NOT commit secrets (env files, credentials, etc.)

---

## Update Policy

Keep this document up to date with all new features, conventions, troubleshooting edge cases, and project structure changes affecting agent or plugin development.

For advanced plugin/API reference and hook/tool extension documentation, see:

- https://opencode.ai/docs/plugins
- https://opencode.ai/docs/permissions
- https://github.com/shekohex/opencode-pty/
