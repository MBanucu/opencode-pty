# Unit Tests: Basics

This section covers the fundamentals of running unit tests with Bun's test runner.

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

**Note**: Tests in this codebase use `it()` (from `bun:test`) rather than `test()`, but both work with `--test-name-pattern`.
