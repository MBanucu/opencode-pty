# Unit Testing Guide for Coding Agents

This document provides comprehensive instructions for running and working with unit tests using Bun's fast, built-in, Jest-compatible test runner.

## Running Unit Tests

### Basic Command

```bash
bun test
```

This runs all test files in the project using Bun's native test runner (Jest-compatible API).

### File Discovery Patterns

Bun automatically discovers test files matching these patterns:

- `*.test.{js,jsx,ts,tsx}`
- `*_test.{js,jsx,ts,tsx}`
- `*.spec.{js,jsx,ts,tsx}`
- `*_spec.{js,jsx,ts,tsx}`

### Run Specific Test Files

```bash
# Run specific test file (requires ./ or / prefix)
bun test ./test/my-test.test.ts

# Filter test files by path substring (not glob patterns)
bun test utils math              # Files with "utils" OR "math" in path
bun test ./test/pty              # Specific directory
```

### Filter Tests by Name

Use `--test-name-pattern` (or `-t`) to run only tests matching a pattern:

```bash
# Run tests with specific name pattern
bun test --test-name-pattern "should calculate"

# Run tests matching regex pattern
bun test -t "(spawn|echo)"

# Verified patterns that work in this codebase:
bun test -t "spawn"              # Matches PTY spawn tests (3 tests)
bun test -t "(integration|echo)" # Matches integration/echo tests
bun test -t "websocket"          # Matches WebSocket tests
```

### AI Agent Integration

Bun test automatically detects AI coding assistants and enables quieter, optimized output. **In opencode, `AGENT=1` is automatically set**, so this optimization is already active when you run `bun test`.

```bash
# When AGENT=1 is set (automatic in opencode), bun test shows:
# - Only test failures in detail
# - Summary statistics
# - Hides passing test output to reduce noise

# Manual activation (not needed in opencode):
AGENT=1 bun test

# Other supported environment variables:
# REPL_ID=1 - For Replit
# CLAUDECODE=1 - For Claude Code
```

When enabled:

- Only test failures are displayed in detail
- Passing, skipped, and todo test indicators are hidden
- Summary statistics remain intact
- Reduces context noise for AI workflows
- **Note**: In opencode, this is automatic - just run `bun test`

### Watch Mode

```bash
# Watch for file changes and re-run tests automatically
bun test --watch
```

Ideal for TDD workflows - tests re-run immediately when source or test files change.

### Additional Options

```bash
# Run tests with longer timeout (default: 5000ms)
bun test --timeout 10000

# Stop after first failure
bun test --bail

# Stop after N failures
bun test --bail=5

# Run tests multiple times to catch flakiness
bun test --rerun-each 5

# Run tests in random order (detects order dependencies)
bun test --randomize

# Reproduce specific random order for debugging
bun test --randomize --seed 12345

# Run only tests marked with test.only() or describe.only()
bun test --only

# Include todo tests
bun test --todo

# Update snapshots
bun test --update-snapshots
# or
bun test -u

# Run tests concurrently (treats all as test.concurrent())
bun test --concurrent

# Limit concurrent tests (default: 20)
bun test --max-concurrency 10

# Memory-saving mode
bun test --smol

# Generate coverage report
bun test --coverage

# Coverage with lcov format (for CI integration)
bun test --coverage --coverage-reporter lcov

# JUnit XML report for CI/CD
bun test --reporter=junit --reporter-outfile=./junit.xml

# Use dots reporter for compact output
bun test --dots

# Show only failures
bun test --only-failures

# Pass with no tests (exit code 0)
bun test --pass-with-no-tests

# Preload setup script before all tests
bun test --preload ./setup.ts
```

## Test Structure

- **Location**: Unit tests are in the `test/` directory (excluding e2e subdir)
- **File naming**: Use `.test.ts` or `.spec.ts` suffix
- **Test framework**: Bun's built-in Jest-compatible API

### Example Test File

```typescript
import { test, expect, describe } from 'bun:test'
import { myFunction } from '../src/my-module'

describe('My Module', () => {
  test('should calculate correctly', () => {
    const result = myFunction(2, 3)
    expect(result).toBe(5)
  })

  test('should handle edge cases', () => {
    expect(myFunction(0, 0)).toBe(0)
  })
})
```

## Advanced Test Features

### Concurrent vs Serial Execution

Control test execution order:

```typescript
import { test } from 'bun:test'

// Run specific tests concurrently (even without --concurrent flag)
test.concurrent('API call 1', async () => {
  await fetch('/api/endpoint1')
})

test.concurrent('API call 2', async () => {
  await fetch('/api/endpoint2')
})

// Force serial execution (even with --concurrent flag)
let sharedState = 0

test.serial('must run first', () => {
  sharedState = 1
  expect(sharedState).toBe(1)
})

test.serial('depends on first', () => {
  expect(sharedState).toBe(1)
  sharedState = 2
})
```

### Test Modifiers

```typescript
import { test } from 'bun:test'

// Run only this test (use with --only flag)
test.only('critical test', () => {
  // Only runs when using bun test --only
})

// Skip this test
test.skip('broken test', () => {
  // This test is ignored
})

// Mark as todo (use with --todo flag)
test.todo('future test', () => {
  // Shows as todo in output
})

// Test expected to fail (inverts pass/fail)
test.failing('should fail', () => {
  expect(false).toBe(true)
})

// Conditional tests
const isMacOS = process.platform === 'darwin'

test.if(isMacOS)('macOS specific', () => {
  // Only runs on macOS
})

test.skipIf(isMacOS)('skip on macOS', () => {
  // Skipped on macOS
})

test.todoIf(isMacOS)('todo on macOS', () => {
  // Marked as todo on macOS
})
```

### Parametrized Tests

Run the same test with multiple data sets:

```typescript
import { test, expect } from 'bun:test'

// Array-based parametrized tests
test.each([
  [1, 2, 3],
  [3, 4, 7],
  [10, 20, 30],
])('add(%i, %i) should equal %i', (a, b, expected) => {
  expect(a + b).toBe(expected)
})

// Object-based parametrized tests
test.each([
  { a: 1, b: 2, expected: 3 },
  { a: 5, b: 5, expected: 10 },
])('add($a, $b) should equal $expected', ({ a, b, expected }) => {
  expect(a + b).toBe(expected)
})

// Chained with other modifiers
test.failing.each([1, 2, 3])('chained failing test %d', (input) => {
  expect(input).toBe(0) // Expected to fail for all inputs
})
```

### Lifecycle Hooks

```typescript
import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from 'bun:test'

// File-level hooks
beforeAll(() => {
  console.log('Runs once before all tests in file')
})

afterAll(() => {
  console.log('Runs once after all tests in file')
})

describe('Test Suite', () => {
  // Suite-level hooks
  beforeEach(() => {
    console.log('Runs before each test in this suite')
  })

  afterEach(() => {
    console.log('Runs after each test in this suite')
  })

  test('example', () => {
    expect(true).toBe(true)
  })
})
```

### Global Setup with Preload

Create a setup file for global configuration:

```typescript
// test-setup.ts
import { beforeAll, afterAll } from 'bun:test'

beforeAll(async () => {
  // Global setup - runs once before all test files
  await startTestServer()
})

afterAll(async () => {
  // Global teardown - runs once after all test files
  await stopTestServer()
})
```

Run with preload:

```bash
bun test --preload ./test-setup.ts
```

Or configure in `bunfig.toml`:

```toml
[test]
preload = ["./test-setup.ts"]
```

### Mocking

```typescript
import { test, expect, mock, spyOn } from 'bun:test'

// Mock function
const fetchData = mock(async () => ({ data: 'mocked' }))

test('mock function', async () => {
  const result = await fetchData()
  expect(fetchData).toHaveBeenCalled()
  expect(fetchData).toHaveBeenCalledTimes(1)
})

// Spy on existing method
const calculator = {
  add: (a: number, b: number) => a + b,
}

const spy = spyOn(calculator, 'add')

test('spy tracks calls', () => {
  calculator.add(2, 3)
  expect(spy).toHaveBeenCalledTimes(1)
  expect(spy).toHaveBeenCalledWith(2, 3)
})
```

### Module Mocking

```typescript
import { test, expect, mock } from 'bun:test'

// Mock a module
mock.module('./my-module', () => ({
  fetchData: mock(async () => ({ data: 'test' })),
  helper: 'mocked value',
}))

test('uses mocked module', async () => {
  const { fetchData } = await import('./my-module')
  const result = await fetchData()
  expect(result.data).toBe('test')
})
```

### Snapshot Testing

```typescript
import { test, expect } from 'bun:test'

test('snapshot test', () => {
  const result = { id: 1, name: 'test' }
  expect(result).toMatchSnapshot()
})

test('inline snapshot', () => {
  const result = { status: 'ok' }
  expect(result).toMatchInlineSnapshot()
  // Bun auto-updates this with the actual value
})
```

Update snapshots:

```bash
bun test --update-snapshots
```

## Common Tasks for Agents

### When to Run Unit Tests

1. **After making changes to**:
   - Utility functions
   - Business logic
   - Data transformation functions
   - Helper modules
   - Agent-facing APIs
   - PTY manager functions

2. **Before submitting PRs**:
   - Run full unit test suite: `bun test`
   - Run with AI-optimized output: `AGENT=1 bun test`
   - Run all tests (unit + E2E): `bun run test:all`
   - Run CI checks: `bun run ci`

### Debugging Failed Tests

1. **Run specific failing test**:

   ```bash
   bun test --test-name-pattern "exact test name"
   ```

2. **Stop on first failure**:

   ```bash
   bun test --bail
   ```

3. **Show only failures**:

   ```bash
   bun test --only-failures
   ```

4. **Increase timeout for slow tests**:

   ```bash
   bun test --timeout 30000
   ```

5. **Use watch mode for rapid debugging**:

   Watch mode is powerful for debugging because it provides immediate feedback as you make changes:

   ```bash
   bun test --watch
   ```

   **How it helps with debugging:**
   - **Instant feedback loop**: When a test fails, add `console.log()` statements to your code or test, save the file, and the test automatically re-runs showing the new output immediately
   - **Smart filtering**: Only runs tests affected by your changes (based on dependency graph), not the entire suite
   - **Iterative debugging**: Try different fixes, add breakpoints via logs, or modify test assertions without manually re-running the command each time
   - **State reset**: Each re-run is a hard process restart, ensuring clean state (no pollution from previous runs)

   **Common debugging workflow:**

   ```bash
   # 1. Run specific failing test in watch mode
   bun test --watch -t "failing test name"

   # 2. Add console.log() in your source code
   # 3. Save file → test auto-re-runs with new output
   # 4. See the logs, fix the issue, save again
   # 5. Test passes → debugging complete
   ```

   **Tips for debugging with watch mode:**
   - Use `--no-clear-screen` to preserve console.log output between runs
   - Combine with `--bail` to stop immediately when your test passes
   - Focus on one test with `-t` pattern to reduce noise
   - Watch mode clears the terminal by default, so errors are always visible at the bottom

6. **Detect flaky tests**:
   ```bash
   bun test --rerun-each 100
   ```

### Writing Unit Tests

When creating new unit tests:

1. Place test files in the `test/` directory
2. Import from `bun:test`: `import { test, expect, describe } from 'bun:test'`
3. Use descriptive test names that explain the expected behavior
4. Cover error cases (permission denied, null inputs, edge cases)
5. Group related tests with `describe()` blocks
6. Use `test.only()` temporarily when debugging a specific test
7. Consider using `test.concurrent()` for independent async tests
8. Use `test.each()` for data-driven tests with multiple inputs

### Test Conventions

```typescript
import { test, expect, describe } from 'bun:test'

describe('Feature Name', () => {
  // Happy path tests
  test('should return correct result for valid input', () => {
    // Arrange
    const input = 'valid'

    // Act
    const result = processInput(input)

    // Assert
    expect(result).toBe('processed')
  })

  // Error case tests
  test('should throw error for invalid input', () => {
    expect(() => processInput(null)).toThrow()
  })

  // Edge case tests
  test('should handle empty input gracefully', () => {
    expect(processInput('')).toBe('')
  })

  // Parametrized tests for multiple scenarios
  test.each([
    { input: 'a', expected: 'A' },
    { input: 'b', expected: 'B' },
  ])('should process $input and return $expected', ({ input, expected }) => {
    expect(processInput(input)).toBe(expected)
  })
})
```

## CI/CD Integration

### GitHub Actions

Bun auto-detects GitHub Actions and emits annotations:

```yaml
name: Tests
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun test
      - run: bun test --coverage --coverage-reporter=lcov
      - uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### JUnit XML for Other CI Systems

```yaml
# GitLab CI example
test:
  script:
    - bun test --reporter=junit --reporter-outfile=./junit.xml
  artifacts:
    reports:
      junit: junit.xml
```

## Comparison: Unit Tests vs E2E Tests

| Aspect          | Unit Tests (`bun test`)       | E2E Tests (`bun run test:e2e`)    |
| --------------- | ----------------------------- | --------------------------------- |
| **Speed**       | Fast (milliseconds)           | Slower (seconds per test)         |
| **Scope**       | Individual functions/modules  | Full application workflow         |
| **Browser**     | No browser (Node/Bun runtime) | Real browsers (Chromium, Firefox) |
| **Purpose**     | Test logic in isolation       | Test user interactions            |
| **When to run** | After code changes, often     | Before PRs, CI pipeline           |
| **Location**    | `test/*.test.ts` (non-e2e)    | `test/e2e/*.pw.ts`                |
| **Watch mode**  | Yes (`--watch`)               | No                                |
| **Concurrent**  | Yes (`--concurrent`)          | Limited                           |

## Troubleshooting

| Issue                    | Solution                                          |
| ------------------------ | ------------------------------------------------- |
| Tests fail with timeout  | Use `--timeout 10000` or check for infinite loops |
| Tests are flaky          | Use `--rerun-each 10` to identify flakiness       |
| Can't find test file     | Check file has `.test.ts` or `_test.ts` suffix    |
| Snapshot tests fail      | Run `bun test --update-snapshots` to update       |
| Memory issues            | Use `--max-concurrency 5` or `--smol` flag        |
| Need to debug one test   | Use `test.only()` and run with `--only` flag      |
| Order-dependent failures | Use `--randomize` to detect dependencies          |
| CI output too verbose    | Use `AGENT=1 bun test` or `--only-failures`       |

## Quick Reference

```bash
# Most common commands
bun test                          # Run all unit tests
bun test --bail                   # Stop on first failure
bun test -t "pattern"             # Run tests matching pattern
bun test --timeout 10000          # Increase timeout
bun test --coverage               # Generate coverage report
bun test --update-snapshots       # Update snapshots
bun test --only-failures          # Show only failures
bun test --watch                  # Watch mode
AGENT=1 bun test                  # AI-optimized output

# Run with other quality checks
bun run typecheck                 # Type checking
bun run lint                      # Linting
bun run test:all                  # Unit + E2E tests
bun run ci                        # Full CI pipeline
```

## Verified Test Patterns (from this codebase)

Based on actual test runs in this repository:

| Command                     | Result                             |
| --------------------------- | ---------------------------------- |
| `bun test -t "spawn"`       | 3 pass, 54 filtered out            |
| `bun test -t "websocket"`   | Matches WebSocket tests            |
| `bun test -t "(pty\|echo)"` | Matches PTY and echo-related tests |
| `bun test -t "integration"` | Matches integration tests          |

**Note**: Tests in this codebase use `it()` (from `bun:test`) rather than `test()`, but both work with `--test-name-pattern`.

---

_For complete Bun test documentation, visit: https://bun.com/docs/test_
