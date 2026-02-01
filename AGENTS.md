# AGENTS.md

This document is the authoritative guide for agentic coding assistants and developers working with this repository. It contains essential information, conventions, and up-to-date instructions.

**opencode-pty** is an OpenCode/Bun plugin enabling interactive management of PTY sessions from both APIs and a modern web UI. It supports concurrent shell sessions, interactive input/output, real-time streaming, regex output filtering, buffer management, status/exits, permission-aware process handling, and agent/plugin extensibility.

## Documentation Sections

Detailed documentation is organized in `.opencode/agents/` directory:

- [Quickstart](./.opencode/agents/docs/quickstart.md) - Installation, usage, and development setup
- [Architecture](./.opencode/agents/docs/architecture.md) - Project structure and terminal system architecture
- [Commands](./.opencode/agents/docs/commands.md) - Development, build, test, and quality check scripts
- [Code Style](./.opencode/agents/docs/code-style.md) - Naming conventions, TypeScript config, formatting, and documentation standards
- [Testing](./.opencode/agents/docs/testing.md) - Unit tests, E2E tests, and testing policies
- [Security](./.opencode/agents/docs/security.md) - Security best practices and guidelines
- [Dependencies](./.opencode/agents/docs/dependencies.md) - Package management and dependency updates
- [Release](./.opencode/agents/docs/release.md) - Release process and workflow
- [Contributing](./.opencode/agents/docs/contributing.md) - Contribution guidelines and PR requirements
- [Troubleshooting](./.opencode/agents/docs/troubleshooting.md) - Common issues and debugging

## Essential Commands

**Development & Build**

- `bun run dev` — Start Vite dev server (frontend only)
- `bun run dev:server` — Start PTY Web UI/API in dev mode
- `bun run build` — Clean, typecheck, and build all assets
- `bun run build:dev` / `bun run build:prod` — Build assets

**Code Quality**

- `bun run lint` / `bun run lint:fix` — Run/auto-fix ESLint
- `bun run format` / `bun run format:check` — Prettier check/format
- `bun run quality` — Lint, format check, and typecheck
- `bun run typecheck` — TypeScript strict check

**Testing**

- `bun test` — Run unit tests (NOT `bun run test`)
- `bun test --test-name-pattern <pattern>` — Run filtered unit tests
- `bun run test:e2e` — Playwright E2E tests (auto-sets `PW_DISABLE_TS_ESM=1`, `NODE_ENV=test`)
- `bun run test:e2e -- --grep "<pattern>"` — Filtered E2E tests (supports `--repeat-each <N>`, `--project <name>`)
- `bun run test:all` / `bun run ci` — All tests with quality checks

## Critical Warnings

### 1. Terminal E2E Testing - Assertion Requirements

**CRITICAL**: All E2E test assertions involving PTY/xterm.js MUST use `getSerializedContentByXtermSerializeAddon(page)` (see `test/e2e/xterm-test-helpers.ts`). Optionally strip ANSI with `bunStripANSI()`.

**PROHIBITED**: DOM scraping of `.xterm` contents, prompt regex matches, or DOM visual state assertions. DOM scraping is allowed for debug/manual logging only, never as test oracle.

**Why**: DOM structure and prompt lines are browser/shell/environment-dependent and introduce test flakiness. SerializeAddon provides robust, platform-stable buffer output.

### 2. Unit Test Commands

Use `bun test` directly (no `test` script exists). For filtering, use `--test-name-pattern`, NOT `--match`.

### 3. E2E Test Environment Variables

`test:e2e` script auto-sets `PW_DISABLE_TS_ESM=1` (disables unneeded Playwright/Bun features) and `NODE_ENV=test` (used by tests). Don't set manually.

### 4. Test Filtering Differences

- Unit tests (Bun): `bun test --test-name-pattern "<pattern>"`
- E2E tests (Playwright): `bun run test:e2e -- --grep "<pattern>"` (note double dash `--`)

### 5. bun-pty Version Check

Codebase includes a monkey-patch for bun-pty race condition (see `src/plugin/pty/manager.ts` lines 8-24). Throws error if bun-pty version exceeds 0.4.8. When upgrading beyond 0.4.8, remove/update this workaround after checking if upstream fix merged (https://github.com/sursaone/bun-pty/pull/37).

## Project Architecture Highlights

### Key Modules

**Plugin Layer** (`src/plugin/`): `plugin.ts` (entry), `pty/manager.ts` (session mgmt), `pty/SessionLifecycle.ts`, `pty/OutputManager.ts`, `pty/NotificationManager.ts`, `pty/permissions.ts`, `pty/buffer.ts`, `pty/tools/` (spawn, read, write, list, kill)

**Web Client** (`src/web/client/`): `App.tsx`, `TerminalRenderer.tsx` (xterm.js class component), `Sidebar.tsx`, `useWebSocket.ts` (connection), `useSessionManager.ts` (operations)

**Web Server** (`src/web/server/`): `server.ts` (Bun HTTP/WebSocket), `handlers/sessions.ts` (REST API), `handlers/websocket.ts`, `CallbackManager.ts` (event publishing)

**Shared** (`src/shared/`, `src/web/shared/`): `types.ts`, `constants.ts`, `apiClient.ts`

### Session Lifecycle

```
spawn → running → [exited | killed]
                      ↓
              (stays in list until cleanup=true)
```

Sessions remain after exit so agent can read final output, check exit code, compare logs. Use `pty_kill` with `cleanup=true` to remove completely.

## Code Conventions Summary

**Naming**: camelCase for functions/variables (`handleSessionClick`), PascalCase for types/classes (`PTYManager`), UPPER_CASE for constants (`DEFAULT_READ_LIMIT`), kebab-case for directories/files

**TypeScript**: Strict mode, `moduleResolution: "bundler"`, `target: ESNext`, no implicit returns/unused vars

**Formatting (Prettier)**: No semicolons, single quotes, ES5 trailing commas, 100 char width, 2 spaces

**Imports/Exports**: Group (external first), prefer named exports, use absolute imports where possible

**Error Handling**: try/catch, descriptive Errors, custom error builders (e.g., `buildSessionNotFoundError`), validate inputs

**Documentation**: JSDoc for public APIs, inline comments for complex logic, no redundant comments

## Special Considerations

### No Dedicated Logging

Uses OpenCode notification system: `client.session.promptAsync()` for user-facing notifications, auto-generated session lifecycle events, `--log-level DEBUG` for debug logging. Toast notifications for user feedback.

### Permission Handling

Respects OpenCode's `permission.bash` and `permission.external_directory`: "allow" → permitted, "deny" → blocked with toast, "ask" → treated as "deny" (plugins can't trigger UI prompts). external_directory "ask" → treated as "allow" with log.

## Appendix

### Minimal .opencode/package.json

For local plugin development, create minimal `package.json` in `.opencode/`:

```json
{
  "name": "opencode-local-plugins",
  "private": true,
  "dependencies": {
    "your-plugin-dep": "^1.0.0"
  }
}
```

Run `bun install` in `.opencode/` and restart OpenCode.

### For Users

See [README.md](./README.md) for usage, installation, and API documentation.
