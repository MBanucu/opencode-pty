# Unit Tests: Advanced Features

This section covers advanced testing features and patterns available in Bun's test runner.

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
