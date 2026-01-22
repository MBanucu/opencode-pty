# Skipped Tests Analysis Report

## Overview
This report analyzes the 6 skipped tests found in the opencode-pty-branches/web-ui workspace. Tests were identified using Bun's test runner, which reported 6 skipped tests across multiple files. The skipping appears to be due to environment compatibility issues with the test framework and DOM requirements.

## Test Environment Issues
The primary reason for skipping these tests is the mismatch between the test framework used (Vitest in some files) and the project's main test runner (Bun). Bun lacks full DOM support required for React Testing Library, causing "document is not defined" errors. Additionally, some e2e tests use Playwright but have configuration issues.

## Test Configuration Files
The following configuration files control the test environments and setups:

### Vitest Configuration (`vitest.config.ts`)
Used for unit and integration tests with React Testing Library:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/web/test-setup.ts'],
    exclude: ['**/e2e/**', '**/node_modules/**'],
  },
});
```

### Playwright Configuration (`playwright.config.ts`)
Used for end-to-end tests:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8867',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'NODE_ENV=test bun run test-web-server.ts',
    url: 'http://localhost:8867',
    reuseExistingServer: true,
  },
});
```

### Test Setup File (`src/web/test-setup.ts`)
Common setup for Vitest tests:
```typescript
import '@testing-library/jest-dom/vitest';

// Mock window.location for jsdom or node environment
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'location', {
    value: {
      host: 'localhost:8867',
      hostname: 'localhost',
      protocol: 'http:',
      port: '8867',
    },
    writable: true,
  });
} else {
  // For node environment, mock global.window
  (globalThis as any).window = {
    location: {
      host: 'localhost:8867',
      hostname: 'localhost',
      protocol: 'http:',
      port: '8867',
    },
  };
}
```

## Detailed Analysis of Skipped Tests

### App.integration.test.tsx
**File:** `src/web/components/App.integration.test.tsx`  
**Framework:** Vitest with @testing-library/react  
**Reason for Skipping:** DOM environment incompatibility with Bun  

#### Test Setup
The test suite uses global mocks to prevent real network connections and WebSocket interactions:
```typescript
// Mock WebSocket to prevent real connections
global.WebSocket = class MockWebSocket {
  constructor() {
    // Mock constructor
  }
  addEventListener() {}
  send() {}
  close() {}
} as any

// Mock fetch to prevent network calls
global.fetch = (() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve([])
})) as any
```

#### 1. "has proper accessibility attributes"
**Purpose:** Verifies initial accessibility attributes and UI structure when no sessions are active.  
**Checks:**
- "PTY Sessions" heading has proper heading role
- No input field shown initially (no session selected)
- Presence of "○ Disconnected" and "No active sessions" elements  

**Implementation:**
```typescript
it.skip('has proper accessibility attributes', () => {
  render(<App />)
  const heading = screen.getByRole('heading', { name: 'PTY Sessions' })
  expect(heading).toBeTruthy()
  const input = screen.queryByPlaceholderText(/Type input/)
  expect(input).toBeNull()
  expect(screen.getByText('○ Disconnected')).toBeTruthy()
  expect(screen.getByText('No active sessions')).toBeTruthy()
})
```

**Why Skipped:** Requires full DOM context for React Testing Library, not available in Bun's test environment.

#### 2. "maintains component structure integrity"
**Purpose:** Ensures the main layout structure remains intact.  
**Checks:**
- Container element exists
- Sidebar and main sections are present  

**Implementation:**
```typescript
it.skip('maintains component structure integrity', () => {
  render(<App />)
  const container = screen.getByText('PTY Sessions').closest('.container')
  expect(container).toBeTruthy()
  const sidebar = container?.querySelector('.sidebar')
  const main = container?.querySelector('.main')
  expect(sidebar).toBeTruthy()
  expect(main).toBeTruthy()
})
```

**Why Skipped:** Same DOM environment issues as above.

### App.e2e.test.tsx
**File:** `src/web/components/App.e2e.test.tsx`  
**Framework:** Vitest with Playwright integration  
**Reason for Skipping:** Entire test suite skipped due to Playwright configuration conflicts with Bun  

#### Test Setup
The test suite employs comprehensive mocking for WebSocket and fetch interactions, with setup and teardown for each test:
```typescript
// Mock WebSocket
let mockWebSocket: any
const createMockWebSocket = () => ({
  send: vi.fn(),
  close: vi.fn(),
  onopen: null as (() => void) | null,
  onmessage: null as ((event: any) => void) | null,
  onerror: null as (() => void) | null,
  onclose: null as (() => void) | null,
  readyState: 1,
})

// Mock fetch for API calls
const mockFetch = vi.fn() as any
global.fetch = mockFetch

// Mock WebSocket constructor
const mockWebSocketConstructor = vi.fn(() => {
  mockWebSocket = createMockWebSocket()
  return mockWebSocket
})

describe.skip('App E2E - Historical Output Fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()

    // Set up mocks
    global.WebSocket = mockWebSocketConstructor as any

    // Mock location
    Object.defineProperty(window, 'location', {
      value: {
        host: 'localhost',
        hostname: 'localhost',
        protocol: 'http:',
      },
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
```

#### Entire Suite: "App E2E - Historical Output Fetching"
**Purpose:** Tests end-to-end functionality for fetching and displaying historical PTY session output.  

**Why Skipped:** The describe block is skipped due to Playwright Test expecting different configuration. Error indicates conflicts between @playwright/test versions or improper setup in Bun environment.

**Individual Tests in the Suite:**

#### 1. "automatically fetches and displays historical output when sessions are loaded"
**Purpose:** Verifies automatic fetching of historical output for exited sessions upon connection.  
**Scenario:** WebSocket connects, receives session list with exited session, auto-selects it, fetches historical output, displays it.  

#### 2. "handles historical output fetch errors gracefully"
**Purpose:** Tests error handling when historical output fetch fails.  
**Scenario:** Fetch rejects with network error, session still appears but shows waiting state.  

#### 3. "fetches historical output when manually selecting exited sessions"
**Purpose:** Ensures manual selection of exited sessions triggers output fetching.  
**Scenario:** User clicks on exited session in sidebar, fetches and displays historical output.  

#### 4. "does not fetch historical output for running sessions on selection"
**Purpose:** Confirms that running sessions don't attempt historical fetches (only live streaming).  
**Scenario:** Running session selected, no fetch called, shows waiting state.  

**Implementation Overview:** All tests use mocked WebSocket and fetch, simulate user interactions, verify API calls and UI updates.

## Recommendations
1. **Unify Test Framework:** Consider switching to Vitest consistently or configure Bun with jsdom for DOM support.
2. **Fix Playwright Setup:** Resolve version conflicts and configuration issues for e2e tests.
3. **Alternative Testing:** Use Playwright for all UI tests to leverage its built-in browser environment.
4. **Gradual Re-enablement:** Start by fixing environment setup, then selectively unskip tests.

## Test Execution Results
- **Total Tests:** 68 across 12 files
- **Passed:** 50
- **Skipped:** 6
- **Failed:** 12
- **Errors:** 2
- **Execution Time:** 4.43s

This report was generated on Wed Jan 21 2026.