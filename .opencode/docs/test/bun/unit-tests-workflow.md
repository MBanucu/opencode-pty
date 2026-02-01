# Unit Tests: Workflow and Integration

This section covers common tasks, CI/CD integration, troubleshooting, and quick references for Bun unit tests.

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
