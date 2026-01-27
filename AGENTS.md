# AGENTS.md

This document is the authoritative and up-to-date guide for both agentic coding assistants and developers working with this repository. It contains essential information, conventions, troubleshooting, workflow guidance, and up-to-date instructions reflecting the current codebase and recommended practices.

**opencode-pty** is an OpenCode/Bun plugin enabling interactive management of PTY (pseudo-terminal) sessions from both APIs and a modern web UI. It supports concurrent shell sessions, interactive input/output, real-time streaming, regex output filtering, buffer management, status/exits, permission-aware process handling, and agent/plugin extensibility.

## Quickstart

### For Users (Install / Upgrade)

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

### For Plugin/Agent Developers (Local Plugins)

- Place TypeScript or JavaScript plugins in `.opencode/plugins/` in your project root.
- For dependencies, include a minimal `.opencode/package.json` (see appendix below).
- No extra config is required for plugins in this directory — just restart OpenCode to reload any changes.
- **If you add dependencies:** Run `bun install` in `.opencode/`. Restart OpenCode to reload new modules.
- For multi-file or build-step plugins, output built files to `.opencode/plugins/`.

### Running the Web UI (PTY sessions)

- Start the PTY Web UI in dev mode:
  ```sh
  bun run e2e/test-web-server.ts
  ```
- Open http://localhost:8766 in your browser (shows session management, streaming, and toolkit features).

---

## Project Structure (Directory/Files)

- `src/plugin/pty/` — Core PTY logic, types, manager, buffer, permissions, and tools
- `src/web/` — React-based web UI, server, live session and terminal interaction
- `test/` — Unit and agent-facing tests
- `e2e/` — End-to-end (Playwright) tests, for web UI/session validation
- Use camelCase for function/variable names; PascalCase for types/classes; UPPER_CASE for constants; kebab-case for directories.

---

## Core Commands & Scripts

- **Development/Run/Build:**
  - `bun run dev` — Start Vite-based development server (frontend only)
  - `bun run dev:server` — Start PTY Web UI/API in dev mode (test Web server)
  - `bun run build` — Clean, typecheck, and build all assets
  - `bun run build:dev` — Build assets in development mode
  - `bun run build:prod` — Build assets in production mode
  - `bun run build:plugin` — Build plugin for OpenCode consumption
  - `bun run install:plugin:dev` — Build + install plugin to local .opencode
  - `bun run install:web:dev` — Build web client in dev mode
  - `bun run install:all:dev` — Build/install plugin & web client
  - `bun run run:all:dev` — Full build/install workflow then run OpenCode (silent)
  - `bun run preview` — Preview built UI site
- **Lint/Format/Quality:**
  - `bun run lint` — Run ESLint on all source (strict)
  - `bun run lint:fix` — ESLint auto-fix
  - `bun run format` — Prettier formatting (writes changes)
  - `bun run format:check` — Prettier check only
  - `bun run quality` — Lint, format check, and typecheck (all code-quality checks)
- **Test & Typecheck:**
  - `bun run typecheck` — Typescript strict check (no emit)
  - `bun run typecheck:watch` — Typecheck in watch mode
  - `bun run test` — Unit tests (Bun test runner, all but e2e/web)
  - `bun run test:watch` — Unit tests in watch mode
  - `bun run test:e2e` — Playwright end-to-end tests; ensure dev server built, use `PW_DISABLE_TS_ESM=1` for Bun
  - `bun run test:all` — All unit + E2E tests
  - Run single/filtered unit test: `bun test --match "<pattern>"`
- **Other:**
  - `bun run clean` — Remove build artifacts, test results, etc.

**Note:** Many scripts have special requirements or additional ENV flags; see inline package.json script comments for platform- or environment-specific details (e.g. Playwright+Bun TS support requires `PW_DISABLE_TS_ESM=1`).

---

## Testing Approach

- **Unit Tests:**
  - Use Bun's test runner (TypeScript; see `test/` folder for examples).
  - Run with `bun run test`.
  - To run a single unit test, use: `bun test --match "<pattern>"`.
  - Test coverage includes agent-facing APIs, logic utilities, and PTY manager functions.

- **End-to-End (E2E) Tests:**
  - Use Playwright (see `e2e/` folder) to validate web UI, PTY session streaming, live events.
  - Run with `bun run test:e2e`. Note for Bun: Playwright requires `PW_DISABLE_TS_ESM=1` as an env var for TypeScript ESM compatibility in Bun; script handles this automatically.
  - To run/play only selected E2E tests, use Playwright's `--grep "<pattern>"`:
    ```sh
    bun run test:e2e -- --grep "SomeFeatureOrTitle"
    ```
  - (Note: `--match` does NOT work for E2E tests; always use `--grep` for Playwright filtering.)

- **All Tests:**
  - Run all (unit and E2E) with `bun run test:all`.
  - CI pipeline uses `bun run ci` (runs lint, format check, typecheck, then all tests).

- **Test structure and conventions:**
  - Place new unit tests in the `test/` folder. Place Playwright/E2E tests in `e2e/`.
  - Use `.test.ts`/`.pw.ts` suffixes for test files as appropriate.
  - For PTY/agent testing, always cover error cases (permission denied, session not found, regex errors).

- **Troubleshooting:**
  - If tests fail intermittently, check for process cleanup and unique session IDs per run.
  - Playwright E2E failures often relate to port conflicts, dev server not running, or TypeScript loader problems.
  - Use `bun run typecheck`, `bun run lint`, and ensure Playwright can launch browsers in your environment (see docs).
  - **Debugging Interactive Input/Output in E2E xterm.js PTY tests:**
    - When testing interactive Bash sessions, always use `.terminal.xterm` as the selector for simulation and output fetch.
    - To verify PTY input/output round-trip:
      - Use `.click()` and if needed, `.focus()` before `type()` or `press()` actions.
      - Insert debug statements before and after typing using `getSerializedContentByXtermSerializeAddon(...)` with `console.log('DEBUG_BEFORE:', ...)` and `console.log('DEBUG_AFTER:', ...)`.
      - Provide short waits (e.g. `waitForTimeout(400)`) after input to ensure the terminal buffer updates.
      - See `e2e/pty-buffer-readraw.pw.ts` line 200+ for the pattern: output the buffer (`console.log`) before and after typing in the terminal, and check that inputs appear as expected.
    - If output is missing or the test is flaky, confirm correct timing, selector, and input sequence by comparing to the robust minimal test (see isolation test, same file, line 54+).

---

## [Next sections will follow this improved outline.]
