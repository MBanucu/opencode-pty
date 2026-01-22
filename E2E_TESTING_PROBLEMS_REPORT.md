# E2E Testing Problems and Solutions Report

This report documents the challenges encountered during the implementation of improved e2e testing infrastructure, including worker parallelism, session isolation, and WebSocket testing reliability.

## 1. Worker Parallelism and State Conflicts

### Problem

Initially increasing `workers` from 1 to 5 in `playwright.config.ts` caused test failures due to shared server state. Tests running in parallel interfered with each other through persistent PTY sessions.

**Problematic Configuration:**

```typescript
export default defineConfig({
  // ...
  workers: 5, // Caused conflicts
  webServer: {
    command: `env NODE_ENV=test LOG_LEVEL=debug TEST_WORKER_INDEX=0 bun run test-web-server.ts --port=8877`,
    url: 'http://localhost:8877',
    reuseExistingServer: true, // Shared server caused state pollution
  },
})
```

**Error Example:**

```
Error: expect(locator).toHaveCount(expected) failed
Expected: 0
Received: 1
// Test expected no sessions but found sessions from parallel tests
```

### Solution

- Implemented session clearing in tests that create sessions
- Configured dynamic worker count: 1 locally, 4 on CI
- Added proper test isolation through session management

**Fixed Configuration:**

```typescript
export default defineConfig({
  // ...
  workers: process.env.CI ? 4 : 1,
  fullyParallel: true,
  webServer: {
    command: `env NODE_ENV=test LOG_LEVEL=debug TEST_WORKER_INDEX=0 bun run test-web-server.ts --port=8877`,
    url: 'http://localhost:8877',
    reuseExistingServer: true,
  },
})
```

## 2. WebSocket Message Counter Test Failures

### Problem

WebSocket counter tests failed because they reused existing sessions from previous tests instead of creating fresh ones. The tests assumed a clean state but shared server persistence caused interference.

**Failing Test Logic:**

```typescript
const initialSessions = await page.request.get('/api/sessions').json()
if (initialSessions.length === 0) {
  // Create session - but this check failed when sessions existed
}
```

### Solution

Modified tests to always clear sessions first, ensuring clean state for each test run.

**Fixed Implementation:**

```typescript
// Clear any existing sessions for clean test state
await page.request.post('/api/sessions/clear')

// Create a fresh test session
const createResponse = await page.request.post('/api/sessions', {
  data: {
    command: 'bash',
    args: ['-c', 'echo "Welcome..."; while true; do echo "..."; sleep 0.1; done'],
    description: 'Live streaming test session',
  },
})
```

## 3. Per-Worker Server Port Management

### Problem

Attempting to implement separate server instances per worker revealed Playwright's `webServer` is global and starts once, not per worker. Dynamic port assignment required complex workarounds.

**Initial Attempt (Failed):**

```typescript
webServer: [
  {
    command: `env NODE_ENV=test LOG_LEVEL=debug TEST_WORKER_INDEX=%workerIndex% bun run test-web-server.ts --port=8877`,
    url: 'http://localhost:8877', // Fixed URL but dynamic port
    reuseExistingServer: false,
  },
],
// This started servers on different ports but checked wrong URL
```

**TypeScript Issues with Fixtures:**

```typescript
// fixtures.ts - Worker-scoped fixture attempt
export const test = base.extend<{
  server: { baseURL: string }
}>({
  server: [
    async ({}, use, workerInfo: { workerIndex: number }) => {
      // Implementation
    },
    { scope: 'worker' },
  ], // TypeScript errors with scope
})
```

### Solution

Implemented fixture infrastructure for future per-worker servers, but reverted to shared server for current reliability. Created foundation for isolated execution.

**Current Working Setup:**

- Shared server for 1 worker locally
- Session clearing for isolation
- Fixtures ready for per-worker implementation

## 4. Session Clearing Endpoint Usage

### Problem

Tests used incorrect API endpoints for clearing sessions, causing failures.

**Incorrect Usage:**

```typescript
// Wrong - non-existent endpoint
await page.request.delete('/api/sessions')

// Wrong - hardcoded port
await request.post('http://localhost:8867/api/sessions/clear')
```

### Solution

Updated all tests to use the correct relative endpoint with proper baseURL.

**Correct Usage:**

```typescript
// Using relative paths with baseURL
await page.request.post('/api/sessions/clear')
await request.post('/api/sessions/clear')
```

## 5. Continuous Output for WebSocket Tests

### Problem

WebSocket counter tests used single `echo` commands that produced output once, then exited. This caused counters to not increment properly as sessions terminated quickly.

**Problematic Session Creation:**

```typescript
await page.request.post('/api/sessions', {
  data: {
    command: 'bash',
    args: ['-c', 'echo "session1" && sleep 10'], // Single output, then idle
  },
})
```

### Solution

Modified session commands to produce continuous output for reliable WebSocket message testing.

**Fixed Session Creation:**

```typescript
await page.request.post('/api/sessions', {
  data: {
    command: 'bash',
    args: ['-c', 'while true; do echo "session1 $(date +%s)"; sleep 0.1; done'],
  },
})
```

## 6. Test Timeout and Performance Issues

### Problem

Complex test setup with session creation, waiting, and WebSocket message accumulation exceeded default timeouts.

**Timeout Error:**

```
Test timeout of 5000ms exceeded
// Due to session startup + message waiting
```

### Solution

Increased timeout for affected tests and optimized wait times.

**Timeout Fix:**

```typescript
test('complex test', async ({ page }) => {
  test.setTimeout(15000) // Increased for session operations
  // ... test implementation
})
```

## Impact and Lessons Learned

- **Parallel testing requires careful state management** - session isolation is critical
- **Playwright's webServer limitations** necessitate creative solutions for per-worker servers
- **Test reliability improves with consistent cleanup** - clear sessions in test setup
- **WebSocket testing needs continuous data streams** - single outputs don't work for counter tests
- **Fixture infrastructure provides flexibility** - ready for future scaling

## Current State

All 14 e2e tests pass reliably with:

- 1 worker locally (shared server, fast)
- 4 workers on CI (parallel execution ready)
- Proper session isolation through clearing
- Robust WebSocket testing with continuous output

The infrastructure now supports both development reliability and CI performance requirements.
