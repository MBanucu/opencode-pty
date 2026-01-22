# Per-Worker Server Implementation Problems

## Overview

Implementing per-worker isolated test servers for Playwright e2e tests revealed several challenges with fixture scoping, TypeScript typing, and test parameter injection.

## 1. Worker-Scoped Fixture Type Errors

### Problem

The initial fixture implementation using `scope: 'worker'` caused TypeScript compilation errors due to incorrect typing of the `WorkerInfo` parameter.

**Initial Failing Code:**

```typescript
export const test = base.extend<TestFixtures, WorkerFixtures>({
  server: [
    async ({}, use, workerInfo: { workerIndex: number }) => {
      // Implementation
    },
    { scope: 'worker' },
  ],
})
```

**Error:**

```
Type '[({}: {}, use: (r: {...}) => Promise<...>, workerInfo: {...}) => Promise<...>, {...}]' is not assignable to type 'TestFixtureValue<...>'.
The types of 'scope' are incompatible between these types.
Type '"worker"' is not assignable to type '"test"'.
```

### Solution

Used the correct `WorkerInfo` type from `@playwright/test` and proper fixture typing.

**Fixed Code:**

```typescript
import { test as base, type WorkerInfo } from '@playwright/test'

export const test = base.extend<TestFixtures, WorkerFixtures>({
  server: [
    async ({}, use, workerInfo: WorkerInfo) => {
      // Implementation
    },
    { scope: 'worker' },
  ],
})
```

## 2. Test Parameter Injection Issues

### Problem

When using extended test fixtures, the `server` parameter was not recognized in test function signatures, causing runtime errors.

**Error:**

```
Test has unknown parameter "server".
```

### Solution

Imported and used the extended test object instead of relying on global test injection.

**Fixed Test Import:**

```typescript
import { test as extendedTest, expect } from '../fixtures'

extendedTest('test name', async ({ page, server }) => {
  // server parameter now available
})
```

## 3. Global vs Extended Test Conflicts

### Problem

Playwright provides global `test` and `expect` objects, but importing extended versions caused identifier conflicts.

**Error:**

```
Duplicate identifier 'test'.
```

### Solution

Removed global imports and used only the extended versions from fixtures.

**Resolution:**

- Removed `import { test, expect } from '@playwright/test'` from test files
- Used `import { test as extendedTest, expect } from '../fixtures'`
- Replaced all `test.` calls with `extendedTest.`

## 4. BaseURL Handling Without Global Config

### Problem

Removing `baseURL` from Playwright config meant `page.request` calls lost their base URL, causing API requests to fail.

**Failing Request:**

```typescript
await page.request.post('/api/sessions') // No baseURL, fails
```

### Solution

Used absolute URLs constructed from the server fixture.

**Fixed Requests:**

```typescript
await page.request.post(server.baseURL + '/api/sessions')
```

## 5. Server Process Cleanup and Port Management

### Problem

Ensuring server processes are properly killed and ports don't conflict required careful process management and error handling.

**Potential Issues:**

- Zombie processes if server doesn't shut down gracefully
- Port conflicts if cleanup fails
- Race conditions between server start and test execution

### Solution

Implemented proper process spawning with SIGTERM signals and exit waiting.

**Cleanup Code:**

```typescript
try {
  await waitForServer(url)
  await use({ baseURL: url, port })
} finally {
  proc.kill('SIGTERM')
  await new Promise((resolve) => proc.on('exit', resolve))
}
```

## 6. Configuration Synchronization

### Problem

Playwright config needed to be updated to remove conflicting settings when using fixtures for server management.

**Conflicting Config:**

```typescript
// These conflict with fixture-managed servers
webServer: { ... },
baseURL: 'http://localhost:8877'
```

### Solution

Removed global `webServer` and `baseURL` from config, letting fixtures handle per-worker server setup.

**Clean Config:**

```typescript
export default defineConfig({
  // No webServer or baseURL
  workers: process.env.CI ? 4 : 1,
  // ...
})
```

## Impact and Resolution Status

- **All TypeScript errors resolved** - Proper typing and imports
- **Test parameter injection working** - Extended test fixtures provide server context
- **Server isolation achieved** - Each worker gets dedicated port and process
- **Cleanup reliable** - Graceful process termination prevents resource leaks
- **Configuration simplified** - No global server config conflicts

The implementation now provides true per-worker server isolation with automatic port assignment, process management, and test context injection.
