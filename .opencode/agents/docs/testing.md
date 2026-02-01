# Testing

## Unit Tests

- Use Bun's test runner (TypeScript; see `test/` folder for examples).
- Run with `bun test`.
- To run filtered unit tests, use: `bun test --test-name-pattern "<pattern>"`.
- Test coverage includes agent-facing APIs, logic utilities, and PTY manager functions.

## End-to-End (E2E) Tests

- Use Playwright (see `e2e/` folder) to validate web UI, PTY session streaming, live events.
- Run with `bun run test:e2e`. Note for Bun: script uses `PW_DISABLE_TS_ESM=1` (disables unneeded Playwright/Bun features) and `NODE_ENV=test` (used by tests) automatically.
- To run/play only selected E2E tests, use Playwright's `--grep "<pattern>"`:
  ```sh
  bun run test:e2e -- --grep "SomeFeatureOrTitle"
  ```
- Also supports `--repeat-each <N>` for flakiness detection and `--project <name>` for specific browser projects.

## All Tests

- Run all (unit and E2E) with `bun run test:all`.
- CI pipeline uses `bun run ci` (runs lint, format check, typecheck, then all tests).

## Test Structure and Conventions

- Place new unit tests in the `test/` folder. Place Playwright/E2E tests in `e2e/`.
- Use `.test.ts`/`.pw.ts` suffixes for test files as appropriate.
- For PTY/agent testing, always cover error cases (permission denied, session not found, regex errors).

## Troubleshooting

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

## Terminal E2E Testing Policy

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
