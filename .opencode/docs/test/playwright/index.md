# E2E Testing Guide for Coding Agents

This document provides comprehensive instructions for running and working with end-to-end (E2E) tests using Playwright.

## Running E2E Tests

### Basic Command

```bash
bun run test:e2e
```

This command automatically sets:

- `PW_DISABLE_TS_ESM=1` - Disables Playwright/Bun TypeScript ESM features that cause issues
- `NODE_ENV=test` - Required environment for test configuration

### Run Specific Tests

Use the `--grep` flag to filter tests by name or pattern:

```bash
# Run tests matching a pattern
bun run test:e2e -- --grep "terminal"

# Run a specific test file
bun run test:e2e e2e/terminal.spec.ts

# Run multiple patterns
bun run test:e2e -- --grep "(terminal|session)"
```

### Additional Options

```bash
# Run tests in headed mode (see browser window)
bun run test:e2e -- --headed

# Run with specific browser
bun run test:e2e -- --browser=firefox

# Run with UI mode for debugging
bun run test:e2e -- --ui

# Run tests multiple times to detect flakiness
bun run test:e2e -- --repeat-each 5

# Run with tracing for debugging failures
bun run test:e2e -- --trace on

# Stop on first failure
bun run test:e2e -- --max-failures=1

# Run in debug mode with inspector
bun run test:e2e -- --debug
```

## Test Structure

- **Location**: All E2E tests are in the `e2e/` directory
- **File naming**: Use `.spec.ts` or `.pw.ts` suffixes
- **Configuration**: `playwright.config.ts` in project root

## Common Tasks for Agents

### When to Run E2E Tests

1. **After making changes to**:
   - Web UI components
   - PTY/session management
   - WebSocket handling
   - Terminal/xterm.js features
   - API endpoints

2. **Before submitting PRs**:
   - Run full E2E suite: `bun run test:e2e`
   - Run all tests: `bun run test:all`

### Debugging Failed Tests

1. **Check test output** for error messages and stack traces
2. **Use headed mode** to see what's happening: `bun run test:e2e -- --headed --grep "<test-name>"`
3. **Enable tracing**: `bun run test:e2e -- --trace on`
4. **View trace report**: `npx playwright show-trace test-results/<trace-file>.zip`
5. **Check artifacts**: Screenshots and videos are saved to `test-results/` on failure

### Writing New E2E Tests

When creating new E2E tests:

1. Place test files in the `e2e/` directory
2. Use `test()` from `@playwright/test`
3. For terminal/PTY tests, use the canonical helper:
   - `getSerializedContentByXtermSerializeAddon(page)` from `e2e/xterm-test-helpers.ts`
   - Never use DOM scraping for assertions
4. For event-driven tests, use `ManagedTestClient` for WebSocket event verification

### Example Test Structure

```typescript
import { test, expect } from '@playwright/test'
import { getSerializedContentByXtermSerializeAddon } from './xterm-test-helpers'

test('feature description', async ({ page }) => {
  // Navigate and interact
  await page.goto('/')

  // Use canonical helper for terminal assertions
  const content = await getSerializedContentByXtermSerializeAddon(page)
  expect(content).toContain('expected text')
})
```

## Important Notes

- Always ensure the dev server is built before running E2E tests
- E2E tests require a running server - they will start one automatically via the test setup
- Tests run headless by default (no visible browser window)
- Test artifacts (screenshots, videos) are saved to `test-results/` when tests fail
- The `PW_DISABLE_TS_ESM=1` flag is critical - without it, Playwright may fail to load TypeScript tests with Bun

## Troubleshooting

| Issue                             | Solution                                                                  |
| --------------------------------- | ------------------------------------------------------------------------- |
| Tests fail with TypeScript errors | Ensure `PW_DISABLE_TS_ESM=1` is set (handled automatically by script)     |
| Browser won't launch              | Install Playwright browsers: `npx playwright install`                     |
| Port conflicts                    | Tests use random ports; check for zombie processes with `lsof -i :<port>` |
| Flaky tests                       | Use `--repeat-each 5` to identify flakiness; check timing and cleanup     |
| WebSocket test failures           | Ensure proper event setup before typing; use `ManagedTestClient`          |
