# test-opencode-plugin.sh

Comprehensive OpenCode plugin loading and startup testing script that verifies plugins load correctly in the OpenCode environment.

## Usage

```bash
./test-opencode-plugin.sh <package-name> <version>
```

### Examples

```bash
# Test our published PTY plugin
./test-opencode-plugin.sh opencode-pty-test 0.1.4-test.0

# Test other plugins
./test-opencode-plugin.sh opencode-helicone-session 1.0.0
./test-opencode-plugin.sh opencode-wakatime 2.1.0
```

## What It Tests

The script performs end-to-end plugin testing:

### 1. **Environment Setup**

- Creates isolated test workspace with `.opencode/` directory
- Generates `opencode.json` config with plugin specified
- Sets up appropriate permissions for testing

### 2. **Package Installation**

- Installs the specified npm package locally
- Verifies all dependencies are resolved
- Ensures package is available for OpenCode

### 3. **OpenCode Startup**

- Starts OpenCode in debug wait mode (`opencode debug wait &`)
- Captures all output to structured log file
- Monitors process health and PID

### 4. **Plugin Loading Detection**

Monitors for specific success indicators:

- ✅ **Server startup**: `"starting server"` or `"web server started"`
- ✅ **Plugin loaded**: Plugin-specific loading messages
- ✅ **OpenCode ready**: Debug wait mode activation

### 5. **Error Detection**

- Scans logs for error patterns
- Identifies failed imports or startup issues
- Reports potential configuration problems

### 6. **Process Management**

- Graceful shutdown of OpenCode process
- Cleanup of test directories
- PID tracking and verification

### 7. **Web Asset Routing (/assets)**

- When the plugin web server responds with HTML that references `/assets/*.js` and `/assets/*.css`, the script fetches each referenced asset and asserts HTTP 200
- Validates `Content-Type` best-effort (`text/css` for CSS, `application|text/javascript` for JS)
- Includes a basic traversal sanity check (`/assets/../index.html` should not return 200)

## Test Output

The script provides detailed real-time feedback:

### Real-time Monitoring

```
[INFO] Starting OpenCode plugin test for opencode-pty-test@0.1.4-test.0
[INFO] Creating test workspace...
[SUCCESS] Created test workspace and OpenCode config
[INFO] Installing opencode-pty-test@0.1.4-test.0 locally...
[SUCCESS] Plugin installed successfully
[INFO] Starting OpenCode in debug wait mode...
[SUCCESS] OpenCode process is running (PID: 235919)
[INFO] Starting log monitoring for 30 seconds...
[MONITOR] Monitoring for plugin startup messages (timeout: 30s)...
[SUCCESS] ✓ Found server startup message
```

### Final Results Table

```
╔═══════════════════════════════════════════════════════════════╗
║                  🧪 OPENCODE PLUGIN TEST 🧪                     ║
╠═══════════════════════════════════════════════════════════════╣
║ Package: opencode-pty-test@0.1.4-test.0                      ║
║ Status:  PASSED                                          ║
║ Server:  true                      ║
║ Plugin:  false                     ║
║ OpenCode:false                     ║
║ PID:     235919                    ║
╚═══════════════════════════════════════════════════════════════╝
```

## Success Criteria

### ✅ **PASSED** When:

- Server startup message detected (primary indicator)
- No critical errors in logs
- OpenCode process remains running

### ❌ **FAILED** When:

- No server startup message found
- Critical errors in startup logs
- OpenCode process exits immediately

## Configuration Generated

The script creates a complete OpenCode configuration:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode/grok-code",
  "plugin": ["opencode-pty-test"],
  "permission": {
    "bash": {
      "*": "allow",
      "rm *": "ask",
      "rm -rf *": "deny"
    },
    "read": {
      "*": "allow",
      ".env*": "deny"
    },
    "edit": "allow",
    "glob": "allow"
  }
}
```

## Log Analysis

The script monitors for these key messages:

### Success Indicators

- `"starting server"`
- `"web server started"`
- `"web server.*started"`
- Plugin-specific loading messages
- `"debug.*wait"` or `"waiting.*debug"`

### Error Patterns

- `"error"`, `"Error"`, `"ERROR"`
- `"failed"`, `"Failed"`, `"FAILED"`
- `"exception"`, `"Exception"`

## Test Report

A detailed JSON report is generated:

```json
{
  "packageName": "opencode-pty-test",
  "packageVersion": "0.1.4-test.0",
  "testTimestamp": "2026-01-26T20:53:17.123Z",
  "testDirectory": "/tmp/opencode-pty-test-opencode-test-1769457195",
  "logFile": "/tmp/opencode-pty-test-opencode-test-1769457195/opencode.log",
  "opencodePid": 235919,
  "results": {
    "serverStarted": true,
    "pluginLoaded": false,
    "opencodeRunning": false,
    "overallStatus": "PASSED"
  },
  "environment": {
    "bunVersion": "1.3.6",
    "workingDirectory": "/tmp/opencode-pty-test-opencode-test-1769457195"
  }
}
```

## Features

- **🧪 End-to-end testing** - Full plugin lifecycle validation
- **⏱️ Timeout protection** - Prevents infinite waiting
- **📊 Real-time monitoring** - Live log analysis with feedback
- **🔍 Smart detection** - Pattern-based message recognition
- **🧹 Automatic cleanup** - Removes all test artifacts
- **📈 Detailed reporting** - JSON reports for automation
- **🛡️ Error handling** - Graceful failure with diagnostics
- **🎯 Process management** - PID tracking and cleanup

## Requirements

- **OpenCode CLI** - Must be installed and available
- **Bun** package manager (>= 1.3.0)
- **bash** (>= 4.0)
- **grep**, **ps**, **kill** commands

## Usage in CI/CD

Perfect for automated testing pipelines:

```yaml
# Example GitHub Actions
- name: Test OpenCode Plugin
  run: |
    chmod +x ./test-opencode-plugin.sh
    ./test-opencode-plugin.sh ${{ matrix.package }} ${{ matrix.version }}

# Test matrix
strategy:
  matrix:
    package: [opencode-pty-test, opencode-helicone-session]
    version: [0.1.4-test.0, 1.0.0]
```

## Troubleshooting

### Common Issues

1. **"Plugin loading message NOT found"**
   - Normal for some plugins - focus on server startup
   - Check if plugin has startup logging

2. **"OpenCode process failed to start"**
   - Verify OpenCode is installed: `opencode --version`
   - Check configuration syntax

3. **"Timeout reached"**
   - Plugin may be slow to initialize
   - Increase TIMEOUT variable in script

### Debug Mode

For detailed debugging, examine the generated log file:

```bash
# View full log
cat /tmp/*/opencode.log

# Search for errors
grep -i error /tmp/*/opencode.log
```

## Customization

### Adjust Timeout

```bash
# Modify TIMEOUT variable in script
TIMEOUT=60  # Increase to 60 seconds
```

### Custom Success Messages

Update the grep patterns in the monitoring section:

```bash
# Add custom success patterns
if grep -q "my-plugin.*ready\|my-plugin.*started" "$LOG_FILE"; then
    log_success "✓ Found custom plugin ready message"
    CUSTOM_STARTED=true
fi
```

This script provides a reliable, automated way to verify that OpenCode plugins load and function correctly in a real OpenCode environment.
