# test-npm-package.sh

Automated npm package testing script that reproduces the comprehensive testing workflow for npm packages.

## Usage

```bash
./test-npm-package.sh <package-name> <version>
```

### Examples

```bash
# Test our published package
./test-npm-package.sh opencode-pty-test 0.1.4-test.0

# Test other packages
./test-npm-package.sh lodash 4.17.21
./test-npm-package.sh react 18.3.1
```

## What It Tests

The script performs a comprehensive automated test suite:

### 1. **Installation Test**

- Creates isolated test workspace
- Installs package using `bun add`
- Verifies package files are present

### 2. **Structure Verification**

- Checks `package.json` exists and is valid
- Verifies main entry point exists
- Detects main export automatically

### 3. **Import Testing**

- Tests named imports: `import { Export } from 'package'`
- Tests namespace imports: `import * as pkg from 'package'`
- Tests default imports where available

### 4. **Runtime Testing**

- Verifies exports can be imported without errors
- Tests export type (function, object, etc.)
- Performs basic structure validation

### 5. **Dependency Resolution**

- Counts total dependencies installed
- Ensures no dependency conflicts

### 6. **Report Generation**

- Creates detailed JSON report
- Provides summary with colored output
- Automatic cleanup

### 7. **Web Asset Routing (/assets)**

- Starts the package's embedded web server in production mode
- Fetches `/` and extracts hashed `/assets/*.js` and `/assets/*.css` URLs
- Verifies each referenced asset returns HTTP 200 with an appropriate `Content-Type`
- Includes a basic traversal sanity check (`/assets/../index.html` should not return 200)

## Output

The script provides:

- **Real-time progress** with colored logging
- **Detailed test results** with success/failure status
- **JSON report** for automation/integration
- **Visual summary** with formatted table

### Example Output

```
╔═══════════════════════════════════════════════════════════════╗
║                    🎉 TEST COMPLETE 🎉                         ║
╠═══════════════════════════════════════════════════════════════╣
║ Package: opencode-pty-test@0.1.4-test.0                      ║
║ Status:  ✅ SUCCESS                                          ║
║ Entry:   index.ts                  ║
║ Export:  PTYPlugin                 ║
║ Deps:    41 packages                   ║
╚═══════════════════════════════════════════════════════════════╝
```

## Features

- **🧹 Automatic cleanup** - Removes test directories after completion
- **🎯 Error handling** - Graceful failure with clear error messages
- **📊 Dependency analysis** - Counts and verifies all dependencies
- **🔍 Export detection** - Automatically finds main exports
- **💾 JSON reporting** - Machine-readable test reports
- **🌈 Colored output** - Clear visual feedback
- **⚡ Fast execution** - Efficient parallel operations

## Requirements

- **Bun** package manager (>= 1.3.0)
- **Node.js** (for package.json analysis)
- **bash** (>= 4.0)

## Exit Codes

- `0` - All tests passed
- `1` - Package installation or testing failed

## Test Report

The script generates `test-report.json` with:

```json
{
  "packageName": "opencode-pty-test",
  "packageVersion": "0.1.4-test.0",
  "testTimestamp": "2026-01-26T20:45:32.123Z",
  "testDirectory": "/tmp/opencode-pty-test-1769456096",
  "mainEntry": "index.ts",
  "mainExport": "PTYPlugin",
  "installSuccess": true,
  "testSuccess": true,
  "assetsRouteTestSuccess": true,
  "dependencies": 41,
  "bunVersion": "1.3.6"
}
```

## Automation Integration

Perfect for CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Test npm package
  run: ./test-npm-package.sh ${{ matrix.package }} ${{ matrix.version }}
```

This provides a reliable, repeatable way to test any npm package's installation and basic functionality.
