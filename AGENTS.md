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

## Terminal System Architecture

### Core Components

- **`RawTerminal` Component** (`src/web/client/components/TerminalRenderer.tsx`): Single React component handling all terminal rendering and input. Uses xterm.js for terminal emulation with optimized diff-based updates.
- **`useWebSocket` Hook** (`src/web/client/hooks/useWebSocket.ts`): Manages WebSocket connections, handles incoming messages (raw_data, session_update, session_list), and routes data to appropriate handlers.
- **`useSessionManager` Hook** (`src/web/client/hooks/useSessionManager.ts`): Handles session lifecycle, input sending, and session switching with buffer fetching.
- **PTY Manager** (`src/plugin/pty/manager.ts`): Server-side session management, process spawning, and buffer operations.

### Data Flow

1. **Input Flow**: User types → `RawTerminal.onData` → `handleSendInput` → POST `/api/sessions/:id/input` → WebSocket `raw_data` message → `onRawData` callback → `rawOutput` state update → `TerminalRenderer.componentDidUpdate` → xterm.js display
2. **Output Flow**: PTY process output → `SessionLifecycle.onData` → buffer append → WebSocket `raw_data` message → `onRawData` → display update
3. **Session Switching**: Click session → `handleSessionClick` → fetch buffer → replace `rawOutput` state → clear and rewrite terminal

### Key Design Decisions

- **No Local Echo**: Input is sent directly to PTY process; PTY handles all echoing to prevent double characters
- **Diff-Based Updates**: Terminal only writes changed content for performance
- **Single Component**: Simplified from inheritance hierarchy to single `RawTerminal` class
- **WebSocket-Driven**: Real-time updates via WebSocket messages rather than polling

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
  - `bun run ci` — Run quality checks and all tests (used by CI pipeline)

**Note:** Many scripts have special requirements or additional ENV flags; see inline package.json script comments for platform- or environment-specific details (e.g. Playwright+Bun TS support requires `PW_DISABLE_TS_ESM=1`).

---

## Code Style & Conventions

### Naming Conventions

- **Functions/Variables**: camelCase (`setOnSessionUpdate`, `rawOutputCallbacks`)
- **Types/Classes**: PascalCase (`PTYManager`, `SessionLifecycleManager`)
- **Constants**: UPPER_CASE (`DEFAULT_READ_LIMIT`, `MAX_LINE_LENGTH`)
- **Directories**: kebab-case (`src/web/client`, `e2e`)
- **Files**: kebab-case for directories, camelCase for components/hooks (`useWebSocket.ts`, `TerminalRenderer.tsx`)

### TypeScript Configuration

- Strict TypeScript settings enabled (`strict: true`)
- Module resolution: `"bundler"` with `"moduleResolution": "bundler"`
- Target: ESNext with modern features
- No implicit returns or unused variables/parameters allowed
- Explicit type annotations required where beneficial

### Formatting (Prettier)

- **Semicolons**: Disabled (`semi: false`)
- **Quotes**: Single quotes preferred (`singleQuote: true`)
- **Trailing commas**: ES5 style (`trailingComma: "es5"`)
- **Print width**: 100 characters (`printWidth: 100`)
- **Indentation**: 2 spaces, no tabs (`tabWidth: 2`, `useTabs: false`)

### Import/Export Style

- Use ES6 imports/exports
- Group imports: external libraries first, then internal modules
- Prefer named exports over default exports for better tree-shaking
- Use absolute imports for internal modules where possible

### Documentation

- Use JSDoc comments for public APIs
- Inline comments for complex logic
- No redundant comments on self-explanatory code

---

## Error Handling & Logging

### Error Handling Patterns

- Use try/catch blocks for operations that may fail
- Throw descriptive `Error` objects with clear messages
- Handle errors gracefully in async operations
- Validate inputs and provide meaningful error messages
- Use custom error builders for common error types (e.g., `buildSessionNotFoundError`)

### Logging Approach

- Logging is handled through the OpenCode client's notification system
- Use `client.session.promptAsync()` for user-facing notifications
- Session lifecycle events (start, exit) generate notifications automatically
- No dedicated logging files; logging is integrated with OpenCode's session system
- Debug logging can be enabled via OpenCode's `--log-level DEBUG` flag

### Exception Safety

- Operations that modify state should be atomic where possible
- Clean up resources in error paths (session cleanup, buffer management)
- Silent failure in notification paths to prevent cascading errors
- Validate session state before operations

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
  - **Buffer Extension Tests**: Recent fixes ensure proper testing of interactive PTY sessions. Tests now use `bash -i` for true interactive sessions and verify that typed input appears in server buffers via WebSocket updates.

---

### Terminal E2E Testing Policy

**Canonical Assertion Source:**  
All assertions in end-to-end (E2E) tests involving PTY or xterm.js terminal output **MUST** use the canonical helper:

- `getSerializedContentByXtermSerializeAddon(page)` (see `e2e/xterm-test-helpers.ts`)
- Optionally stripping ANSI with `bunStripANSI()` if comparing plain strings/lines.

**What is Prohibited:**

- ❌ DOM scraping of `.xterm` contents for test assertions (e.g., querying for DOM nodes/spans and asserting text/prompt lines)
- ❌ Relying on prompt regexes/matches (e.g., counting `$` prompts by scraping or by line rules)
- ❌ Any assertion on terminal output that is based on DOM visual state or prompt-matching rather than the raw buffer

**Debug/Manual Reporting:**

- You MAY use `getTerminalPlainText(page)`/DOM scraping only for debug or manual reporting/logging, **never as a test oracle** for pass/fail.
- Visual verification/console output is allowed for troubleshooting but must not drive assertion logic or test results.

**Why:**

- DOM structure and prompt lines are browser/shell/environment-dependent and introduce test flakiness.
- SerializeAddon provides robust and platform-stable buffer output, reflecting the true logical state.

**Enforcement:**

- All PRs/commits adding or modifying terminal E2E tests will be rejected if they use DOM scraping, prompt regex counting, or prompt-matching as a required assertion.
- Legacy test code must be refactored to comply.

---

## Security Best Practices

### Input Validation

- Validate all user inputs before processing
- Use regex pattern validation for search/filter operations
- Sanitize file paths and command arguments
- Check permissions before executing operations

### Process Security

- PTY sessions run with user permissions only
- External directory access controlled via permission settings
- No elevated privileges or sudo operations
- Session isolation prevents cross-session interference

### Dependency Security

- Regular dependency updates via `bun install`
- CI includes security scanning (CodeQL, dependency review)
- No secrets or credentials committed to repository
- Environment variables used for sensitive configuration

### Code Security

- Strict TypeScript prevents type-related vulnerabilities
- ESLint rules enforce secure coding patterns
- No dynamic code execution or eval usage
- Buffer overflow protection through TypeScript bounds checking

---

## Dependency Management

### Package Management

- **Runtime**: Bun for fast package management and execution
- **Dependencies**: Listed in `package.json` with specific versions
- **Lockfile**: `bun.lockb` ensures reproducible installs
- **Peer Dependencies**: TypeScript ^5 required

### Key Dependencies

- `@opencode-ai/plugin` & `@opencode-ai/sdk` — OpenCode integration
- `@xterm/xterm` & `@xterm/addon-*` — Terminal emulation
- `bun-pty` — PTY process management
- `react` & `react-dom` — Web UI framework
- `strip-ansi` — ANSI escape sequence removal

### Development Dependencies

- Testing: `@playwright/test`, Bun test runner
- Code Quality: `eslint`, `prettier`, `typescript`
- Build: `vite`, `@vitejs/plugin-react`

### Updating Dependencies

- Use `bun update <package>` for specific package updates
- Run full test suite after updates
- Check for breaking changes in changelogs
- Update lockfile and commit together

---

## Release Process

### Automated Release

- Releases triggered by version bumps to main branch
- Use `./release.sh` script for version management:
  ```sh
  ./release.sh --patch  # Patch version bump
  ./release.sh --minor  # Minor version bump
  ./release.sh --major  # Major version bump
  ./release.sh --dry-run  # Preview changes
  ```

### Release Workflow

1. **Version Bump**: Script updates `package.json` version
2. **Git Tag**: Creates `v{X.Y.Z}` tag on main branch
3. **GitHub Actions**: Triggers release workflow
4. **NPM Publish**: Automated publishing with provenance
5. **Changelog**: Generated from git commit history

### Pre-release Checks

- All tests pass (`bun run ci`)
- Build succeeds (`bun run build`)
- No uncommitted changes
- Git working directory clean

### Post-release

- Version available on NPM within minutes
- OpenCode plugin updates automatically
- GitHub release created with changelog

---

## Contributing Guidelines

### Development Workflow

1. **Fork & Branch**: Create feature branch from main
2. **Code Changes**: Follow established conventions
3. **Testing**: Add/update tests for new functionality
4. **Quality Checks**: Run `bun run quality` before committing
5. **Commit**: Use descriptive commit messages
6. **Pull Request**: Create PR with clear description

### Pull Request Requirements

- **Tests**: Include unit and E2E tests as appropriate
- **Documentation**: Update AGENTS.md for significant changes
- **Breaking Changes**: Clearly document API changes
- **Code Review**: Address review feedback
- **CI**: All checks must pass

### Code Review Checklist

- [ ] TypeScript types correct and complete
- [ ] Error handling appropriate
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Security considerations addressed
- [ ] Performance implications considered
- [ ] Code style conventions followed

### Commit Message Convention

- Use imperative mood: "Add feature" not "Added feature"
- Start with action verb (Add, Fix, Update, Remove, etc.)
- Keep first line under 50 characters
- Add detailed description for complex changes

---

## Troubleshooting

### Common Issues

#### Build Failures

- **Type errors**: Run `bun run typecheck` to identify issues
- **Lint errors**: Use `bun run lint:fix` for auto-fixable issues
- **Missing dependencies**: Run `bun install` to ensure all packages installed

#### Test Failures

- **Unit tests**: Check for race conditions or state leakage between tests
- **E2E tests**: Verify dev server running, check browser console for errors
- **Flaky tests**: Increase timeouts or add explicit waits

#### Runtime Issues

- **Permission denied**: Check PTY session permissions in OpenCode settings
- **Session not found**: Verify session ID and lifecycle
- **Buffer issues**: Check buffer size limits and regex patterns

#### Development Environment

- **Bun version**: Ensure Bun latest version installed
- **Node modules**: Clear cache with `rm -rf node_modules && bun install`
- **Port conflicts**: Check if dev server ports (8766) are available

### Debug Mode

- Enable verbose logging: `opencode --log-level DEBUG --print-logs`
- Check debug logs in `~/.local/share/opencode/logs/`
- Use browser dev tools for WebSocket debugging

---

## Event-Driven E2E Testing

For flaky tests involving terminal input/output, use **WebSocket events** instead of HTTP polling:

### Pattern

```typescript
import { ManagedTestClient } from '../utils'
import type { WSMessageServerRawData } from '../../src/web/shared/types'

// 1. Connect WebSocket and subscribe to session (direct approach)
wsClient.send({
  type: 'subscribe',
  sessionId,
})

// 2. Set up listener BEFORE typing to avoid race conditions
const aReceivedInTimePromise = wsClient.verifyCharacterInEvents(sessionId, 'a', 5000)

// 3. Type input in terminal
await typeInTerminal(page, 'a')

// 4. Wait for character in events (anti-race condition)
const aReceivedInTime = await aReceivedInTimePromise

// 5. Verify that typing generates WebSocket events
expect(aReceivedInTime).toBe(true)

// 6. Verify final buffer state (flexible length + character presence)
const afterRaw = await getRawBuffer(api, sessionId)
expect(afterRaw.length).toBeGreaterThan(initialRaw.length)
expect(afterRaw).toContain('a')
```

### Why This Works

- **No Race Condition**: Sets up WebSocket listener BEFORE typing to prevent race condition
- **Event-Driven Verification**: Waits for actual `raw_data` events instead of polling
- **Proper Timing**: Events arrive when bash processes input, not immediately
- **Reliable**: Event-driven verification handles bash processing variations
- **Clean Resources**: Automatic disposal via DisposableStack prevents leaks

### Usage

- **WebSocket Helper**: `ManagedTestClient` provides event-driven methods
- **Test Fixtures**: `wsClient` fixture with `using` pattern for cleanup
- **Shared Infrastructure**: `ManagedTestClient` works for both unit and E2E tests

### Implementation

```typescript
// In test fixtures
wsClient: async ({ server }, use) => {
  await using client = await ManagedTestClient.create(`${server.baseURL.replace(/^http/, 'ws')}/ws`)
  await use(client)
}

// In test cases
const aReceivedInTime = await wsClient.verifyCharacterInEvents(sessionId, 'a', 5000)
expect(aReceivedInTime).toBe(true)

// Verify final buffer state (flexible length + character presence)
const afterRaw = await getRawBuffer(api, sessionId)
expect(afterRaw.length).toBeGreaterThan(initialRaw.length)
expect(afterRaw).toContain('a')
```

This pattern eliminates flaky behavior by **setting up WebSocket listeners before typing** and **waiting for actual buffer updates** rather than assuming immediate response to input.

---

## Appendix: Minimal .opencode/package.json

For local plugin development, create a minimal `package.json` in `.opencode/`:

```json
{
  "name": "opencode-local-plugins",
  "private": true,
  "dependencies": {
    "your-plugin-dep": "^1.0.0"
  }
}
```

Then run `bun install` in `.opencode/` and restart OpenCode.
