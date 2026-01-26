#!/usr/bin/env bash

# test-opencode-plugin.sh - Test OpenCode plugin loading and startup
# 
# Usage: ./test-opencode-plugin.sh <package-name> <version>
# Example: ./test-opencode-plugin.sh opencode-pty-test 0.1.4-test.0

set -euo pipefail

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# --- Helper Functions ---
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_debug() {
    echo -e "${CYAN}[DEBUG]${NC} $1"
}

cleanup() {
    if [[ -n "${OPENCODE_PID:-}" ]]; then
        log_info "Terminating OpenCode process (PID: $OPENCODE_PID)..."
        kill $OPENCODE_PID 2>/dev/null || true
        # Wait a bit for graceful shutdown
        sleep 2
        # Force kill if still running
        kill -9 $OPENCODE_PID 2>/dev/null || true
    fi
    
    if [[ -n "${TEST_DIR:-}" && -d "$TEST_DIR" ]]; then
        log_info "Cleaning up test directory: $TEST_DIR"
        rm -rf "$TEST_DIR"
    fi
    
    # Kill any remaining opencode processes from this user
    pkill -f "opencode debug wait" 2>/dev/null || true
}

# Set trap for cleanup
trap cleanup EXIT

# --- Argument Parsing ---
if [[ $# -ne 2 ]]; then
    echo "Usage: $0 <package-name> <version>"
    echo "Example: $0 opencode-pty-test 0.1.4-test.0"
    exit 1
fi

PACKAGE_NAME="$1"
PACKAGE_VERSION="$2"
TEST_DIR="/tmp/${PACKAGE_NAME}-opencode-test-$(date +%s)"
LOG_FILE="$TEST_DIR/opencode.log"
TIMEOUT=5  # seconds to wait for startup
ASSETS_TEST_SUCCESS=false

log_info "Starting OpenCode plugin test for ${PACKAGE_NAME}@${PACKAGE_VERSION}"
log_info "Test directory: $TEST_DIR"
log_info "Log file: $LOG_FILE"

# --- 1. Create Test Workspace ---
log_info "Creating test workspace..."
mkdir -p "$TEST_DIR/.opencode"
cd "$TEST_DIR"

# Create .opencode/opencode.json with the plugin
cat > .opencode/opencode.json << EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "model": "opencode/grok-code",
  "plugin": ["${PACKAGE_NAME}"],
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
EOF

log_success "Created test workspace and OpenCode config"

# --- 2. Install Plugin Package ---
log_info "Installing ${PACKAGE_NAME}@${PACKAGE_VERSION} locally..."
if bun add "${PACKAGE_NAME}@${PACKAGE_VERSION}" --save-dev; then
    log_success "Plugin installed successfully"
else
    log_error "Failed to install plugin package"
    exit 1
fi

# --- 3. Create Log Monitor ---
log_info "Setting up log monitoring..."
# Create a script to monitor logs for plugin startup messages
cat > monitor-logs.sh << 'MONITOR_EOF'
#!/usr/bin/env bash

LOG_FILE="$1"
TIMEOUT="$2"
STARTED=false
SERVER_STARTED=false
PLUGIN_LOADED=false

log_info() {
    echo -e "\033[0;36m[MONITOR]\033[0m $1"
}

log_success() {
    echo -e "\033[0;32m[SUCCESS]\033[0m $1"
}

log_warn() {
    echo -e "\033[1;33m[WARN]\033[0m $1"
}

# Monitor the log file for specific messages
log_info "Monitoring for plugin startup messages (timeout: ${TIMEOUT}s)..."

# Wait for log file to exist and start monitoring
for ((i=0; i<TIMEOUT; i++)); do
    if [[ -f "$LOG_FILE" ]]; then
        # Check for plugin loading indicators
        if grep -q "starting server\|web server started\|web server.*started" "$LOG_FILE" 2>/dev/null; then
            log_success "✓ Found server startup message"
            SERVER_STARTED=true
        fi
        
        if grep -q "plugin.*loaded\|loaded.*plugin\|PTY.*plugin" "$LOG_FILE" 2>/dev/null; then
            log_success "✓ Found plugin loading message"
            PLUGIN_LOADED=true
        fi
        
        if grep -q "debug.*wait\|waiting.*debug" "$LOG_FILE" 2>/dev/null; then
            log_success "✓ OpenCode is in debug wait mode"
            STARTED=true
        fi
        
        # Check for errors
        if grep -q "error\|Error\|ERROR\|failed\|Failed\|FAILED" "$LOG_FILE" 2>/dev/null; then
            log_warn "⚠ Found potential error messages in log"
            grep -i "error\|failed" "$LOG_FILE" | tail -3
        fi
        
        # If we found our key indicators, we can stop monitoring
        if [[ "$SERVER_STARTED" == "true" && "$PLUGIN_LOADED" == "true" && "$STARTED" == "true" ]]; then
            log_success "All expected messages found! Plugin appears to be working."
            exit 0
        fi
    fi
    
    sleep 1
    echo -n "."
done

echo
log_warn "Timeout reached. Checking final log state..."

# Final check
if [[ "$SERVER_STARTED" == "true" ]]; then
    log_success "Server startup message found"
else
    log_warn "Server startup message NOT found"
fi

if [[ "$PLUGIN_LOADED" == "true" ]]; then
    log_success "Plugin loading message found"
else
    log_warn "Plugin loading message NOT found"
fi

if [[ "$STARTED" == "true" ]]; then
    log_success "OpenCode debug wait found"
else
    log_warn "OpenCode debug wait NOT found"
fi

exit 0
MONITOR_EOF

chmod +x monitor-logs.sh

# --- 4. Start OpenCode in Background ---
log_info "Starting OpenCode in debug wait mode..."
log_info "This will load the plugin and wait for debugging..."

# Start OpenCode in background with output redirected to log file
# Force production-style HTML/assets routing for this integration test
# so that /assets/* is exercised.
NODE_ENV=production opencode debug wait > "$LOG_FILE" 2>&1 &
OPENCODE_PID=$!

log_info "OpenCode started with PID: $OPENCODE_PID"

# Wait a moment for OpenCode to start
sleep 2

# Check if process is still running
if ! kill -0 $OPENCODE_PID 2>/dev/null; then
    log_error "OpenCode process failed to start or exited immediately"
    if [[ -f "$LOG_FILE" ]]; then
        log_error "Last 10 lines of log:"
        tail -10 "$LOG_FILE"
    fi
    exit 1
fi

log_success "OpenCode process is running"

# --- 5. Monitor Plugin Loading ---
log_info "Starting log monitoring for ${TIMEOUT} seconds..."

# Run the log monitor in background
./monitor-logs.sh "$LOG_FILE" $TIMEOUT &
MONITOR_PID=$!

# Wait for monitoring to complete
wait $MONITOR_PID

# --- 6. Analyze Results ---
log_info "Analyzing plugin loading results..."

# Check for expected success indicators
SERVER_STARTED=false
PLUGIN_LOADED=false
OPENCODE_RUNNING=false

if [[ -f "$LOG_FILE" ]]; then
    if grep -q "starting server\|web server started\|web server.*started" "$LOG_FILE" 2>/dev/null; then
        SERVER_STARTED=true
        log_success "✅ Plugin server startup message found"
    else
        log_warn "⚠️ Plugin server startup message NOT found"
    fi
    
    if grep -q "plugin.*loaded\|loaded.*plugin\|PTY.*plugin\|${PACKAGE_NAME}" "$LOG_FILE" 2>/dev/null; then
        PLUGIN_LOADED=true
        log_success "✅ Plugin loading indicators found"
    else
        log_warn "⚠️ Plugin loading indicators NOT found"
    fi
    
    if grep -q "debug.*wait\|waiting.*debug" "$LOG_FILE" 2>/dev/null; then
        OPENCODE_RUNNING=true
        log_success "✅ OpenCode debug wait mode active"
    fi
    
    # Look for any errors
    ERROR_COUNT=$(grep -ciE "error|failed|exception" "$LOG_FILE" 2>/dev/null || true)
    ERROR_COUNT=${ERROR_COUNT:-0}
    if [[ "$ERROR_COUNT" =~ ^[0-9]+$ ]] && [[ $ERROR_COUNT -gt 0 ]]; then
        log_warn "⚠️ Found $ERROR_COUNT potential error(s) in log"
        echo "Recent errors:"
        grep -i "error\|failed\|exception" "$LOG_FILE" | tail -5
    else
        log_success "✅ No errors found in log"
    fi
fi

# Check if OpenCode is still running
if kill -0 $OPENCODE_PID 2>/dev/null; then
    log_success "✅ OpenCode process still running"
else
    log_warn "⚠️ OpenCode process stopped"
fi

# --- 7. Test Web Server with curl ---
if [[ "$SERVER_STARTED" == "true" ]]; then
    log_info "Testing web server with curl..."
    
    # Extract port from log
    SERVER_PORT=$(grep -o 'port":[0-9]*' "$LOG_FILE" | head -1 | cut -d':' -f2)
    if [[ -z "$SERVER_PORT" ]]; then
        SERVER_PORT="8765"  # Default port
        log_info "Using default port: $SERVER_PORT"
    else
        log_info "Found server port: $SERVER_PORT"
    fi
    
    SERVER_URL="http://localhost:$SERVER_PORT"
    WEB_TEST_RESULTS=()
    
    # Test 1: Basic connectivity
    log_info "Testing basic connectivity to $SERVER_URL..."
    CONNECT_STATUS=$(curl -s --connect-timeout 5 --max-time 10 -o /dev/null -w "%{http_code}" "$SERVER_URL" || echo "000")
    if echo "$CONNECT_STATUS" | grep -q "200\|302\|301\|404"; then
        WEB_TEST_RESULTS+=("✅ Basic connectivity: SUCCESS (HTTP $CONNECT_STATUS)")
        log_success "✅ Server responds to HTTP requests (HTTP $CONNECT_STATUS)"
    else
        WEB_TEST_RESULTS+=("❌ Basic connectivity: FAILED")
        log_warn "❌ Server not responding on $SERVER_URL"
    fi
    
    # Test 2: HTML page loads
    log_info "Testing HTML page load..."
    HTTP_STATUS=$(curl -s --connect-timeout 5 --max-time 10 -w "%{http_code}" -o "$TEST_DIR/response.html" "$SERVER_URL" || echo "000")
    
    if [[ "$HTTP_STATUS" == "200" ]]; then
        WEB_TEST_RESULTS+=("✅ HTML page load: SUCCESS (HTTP $HTTP_STATUS)")
        log_success "✅ HTML page loads successfully"
        
        # Test 3: Check HTML content
        if [[ -s "$TEST_DIR/response.html" ]]; then
            HTML_SIZE=$(wc -c < "$TEST_DIR/response.html")
            if [[ $HTML_SIZE -gt 100 ]]; then
                WEB_TEST_RESULTS+=("✅ HTML content: SUCCESS ($HTML_SIZE bytes)")
                log_success "✅ HTML content loaded ($HTML_SIZE bytes)"
                
                # Test 4: Check for expected HTML elements
                if grep -q "<!DOCTYPE html>" "$TEST_DIR/response.html" 2>/dev/null; then
                    WEB_TEST_RESULTS+=("✅ HTML structure: VALID DOCTYPE")
                    log_success "✅ Valid HTML structure found"
                else
                    WEB_TEST_RESULTS+=("⚠️ HTML structure: NO DOCTYPE")
                    log_warn "⚠️ HTML missing DOCTYPE declaration"
                fi
                
                if grep -q "<script" "$TEST_DIR/response.html" 2>/dev/null; then
                    WEB_TEST_RESULTS+=("✅ JavaScript: SCRIPTS FOUND")
                    log_success "✅ JavaScript scripts found in HTML"
                else
                    WEB_TEST_RESULTS+=("⚠️ JavaScript: NO SCRIPTS")
                    log_warn "⚠️ No JavaScript scripts found"
                fi

                # Test 4b: Verify /assets routes work for hashed assets referenced by HTML
                if grep -q "/assets/" "$TEST_DIR/response.html" 2>/dev/null; then
                    log_info "Testing /assets routes referenced by HTML..."
                    ASSETS_TEST_SUCCESS=true

                    # Extract unique /assets/*.js and /assets/*.css paths from the HTML using Node
                    ASSET_PATHS=$(node -e "
const fs = require('fs');
const html = fs.readFileSync(process.argv[1], 'utf8');
const js = [...html.matchAll(/src=\"(\\/assets\\/[^\"\n]+\\.js)\"/g)].map(m => m[1]);
const css = [...html.matchAll(/href=\"(\\/assets\\/[^\"\n]+\\.css)\"/g)].map(m => m[1]);
const all = Array.from(new Set([...js, ...css]));
for (const a of all) console.log(a);
" "$TEST_DIR/response.html" 2>/dev/null || true)

                    if [[ -z "${ASSET_PATHS}" ]]; then
                        ASSETS_TEST_SUCCESS=false
                        WEB_TEST_RESULTS+=("❌ Assets: NO /assets/*.js|*.css FOUND")
                        log_warn "❌ No /assets/*.js or /assets/*.css found in HTML"
                    else
                        while IFS= read -r asset; do
                            [[ -z "${asset}" ]] && continue
                            ASSET_HTTP_STATUS=$(curl -s --connect-timeout 5 --max-time 10 -w "%{http_code}" -o /dev/null "$SERVER_URL$asset" || echo "000")
                            if [[ "$ASSET_HTTP_STATUS" != "200" ]]; then
                                ASSETS_TEST_SUCCESS=false
                                WEB_TEST_RESULTS+=("❌ Asset fetch: FAILED ($asset HTTP $ASSET_HTTP_STATUS)")
                                log_warn "❌ Asset fetch failed: $asset (HTTP $ASSET_HTTP_STATUS)"
                                continue
                            fi

                            # Validate Content-Type (best-effort)
                            CONTENT_TYPE=$(curl -sI --connect-timeout 5 --max-time 10 "$SERVER_URL$asset" | tr -d '\r' | grep -i '^content-type:' | head -1 | cut -d':' -f2- | xargs || true)
                            if [[ "$asset" == *.js ]]; then
                                if ! echo "${CONTENT_TYPE}" | tr '[:upper:]' '[:lower:]' | grep -Eq '^(application|text)/javascript(\s*;|$)'; then
                                    ASSETS_TEST_SUCCESS=false
                                    WEB_TEST_RESULTS+=("❌ Asset content-type: BAD ($asset $CONTENT_TYPE)")
                                    log_warn "❌ Unexpected JS content-type for $asset: ${CONTENT_TYPE:-<missing>}"
                                fi
                            fi
                            if [[ "$asset" == *.css ]]; then
                                if ! echo "${CONTENT_TYPE}" | tr '[:upper:]' '[:lower:]' | grep -Eq '^text/css(\s*;|$)'; then
                                    ASSETS_TEST_SUCCESS=false
                                    WEB_TEST_RESULTS+=("❌ Asset content-type: BAD ($asset $CONTENT_TYPE)")
                                    log_warn "❌ Unexpected CSS content-type for $asset: ${CONTENT_TYPE:-<missing>}"
                                fi
                            fi
                        done <<< "$ASSET_PATHS"

                        # Traversal sanity check
                        TRAVERSAL_STATUS=$(curl -s --connect-timeout 5 --max-time 10 -w "%{http_code}" -o /dev/null "$SERVER_URL/assets/../index.html" || echo "000")
                        if [[ "$TRAVERSAL_STATUS" == "200" ]]; then
                            ASSETS_TEST_SUCCESS=false
                            WEB_TEST_RESULTS+=("❌ Assets traversal: VULNERABLE (HTTP 200)")
                            log_warn "❌ Traversal request unexpectedly succeeded: /assets/../index.html"
                        fi

                        if [[ "$ASSETS_TEST_SUCCESS" == "true" ]]; then
                            WEB_TEST_RESULTS+=("✅ Assets: HASHED ASSETS SERVED")
                            log_success "✅ /assets routes verified for referenced assets"
                        fi
                    fi
                else
                    ASSETS_TEST_SUCCESS=false
                    WEB_TEST_RESULTS+=("❌ Assets: NOT REFERENCED")
                    log_warn "❌ HTML does not reference /assets/"
                fi
            else
                WEB_TEST_RESULTS+=("❌ HTML content: TOO SMALL ($HTML_SIZE bytes)")
                log_warn "❌ HTML content too small ($HTML_SIZE bytes)"
            fi
        else
            WEB_TEST_RESULTS+=("❌ HTML content: EMPTY")
            log_warn "❌ HTML response is empty"
        fi
    else
        WEB_TEST_RESULTS+=("❌ HTML page load: FAILED (HTTP $HTTP_STATUS)")
        log_warn "❌ Failed to load HTML (HTTP $HTTP_STATUS)"
    fi
    
    # Test 5: API endpoint (if exists)
    log_info "Testing API endpoint..."
    API_STATUS=$(curl -s --connect-timeout 5 --max-time 10 -w "%{http_code}" -o /dev/null "$SERVER_URL/api/sessions" || echo "000")
    
    if [[ "$API_STATUS" == "200" ]]; then
        WEB_TEST_RESULTS+=("✅ API endpoint: SUCCESS")
        log_success "✅ API endpoint accessible"
    elif [[ "$API_STATUS" == "404" ]]; then
        WEB_TEST_RESULTS+=("⚠️ API endpoint: NOT FOUND (expected)")
        log_info "⚠️ API endpoint returns 404 (may be expected)"
    else
        WEB_TEST_RESULTS+=("❌ API endpoint: FAILED (HTTP $API_STATUS)")
        log_warn "❌ API endpoint failed (HTTP $API_STATUS)"
    fi
    
    # Test 6: Static assets
    log_info "Testing static assets..."
    ASSETS_STATUS=$(curl -s --connect-timeout 5 --max-time 10 -w "%{http_code}" -o /dev/null "$SERVER_URL/assets/" || echo "000")
    
    if [[ "$ASSETS_STATUS" == "200" || "$ASSETS_STATUS" == "404" ]]; then
        WEB_TEST_RESULTS+=("✅ Static assets: ACCESSIBLE")
        log_success "✅ Static assets endpoint accessible"
    else
        WEB_TEST_RESULTS+=("❌ Static assets: FAILED")
        log_warn "❌ Static assets not accessible"
    fi
    
    # Display web test results
    log_info "Web Server Test Results:"
    for result in "${WEB_TEST_RESULTS[@]}"; do
        echo "  $result"
    done
    
    # Show sample HTML content for debugging
    if [[ -f "$TEST_DIR/response.html" && -s "$TEST_DIR/response.html" ]]; then
        log_info "First 5 lines of HTML response:"
        echo "─────────────────────────────────────────────────────────────"
        head -5 "$TEST_DIR/response.html"
        echo "─────────────────────────────────────────────────────────────"
    fi
else
    log_warn "Skipping web server tests - server not started"
fi

# --- 8. Generate Test Report ---

# --- 7. Generate Test Report ---
log_info "Generating test report..."

OVERALL_STATUS="PASSED"
if [[ "$SERVER_STARTED" == "false" ]]; then
    OVERALL_STATUS="FAILED"
fi

# Check if web tests ran successfully (if applicable)
if [[ "$SERVER_STARTED" == "true" && -n "${WEB_TEST_RESULTS:-}" ]]; then
    # Check if any critical web tests failed
    if echo "${WEB_TEST_RESULTS[@]}" | grep -q "❌"; then
        log_warn "⚠️ Critical web test failures detected"
        # Fail the test if HTML fails OR if /assets routing checks fail
        if echo "${WEB_TEST_RESULTS[@]}" | grep -q "HTML page load: FAILED"; then
            OVERALL_STATUS="FAILED"
        fi
        if [[ "${ASSETS_TEST_SUCCESS}" != "true" ]] && echo "${WEB_TEST_RESULTS[@]}" | grep -q "Assets:"; then
            OVERALL_STATUS="FAILED"
        fi
    fi
fi

cat > test-report.json << EOF
{
  "packageName": "${PACKAGE_NAME}",
  "packageVersion": "${PACKAGE_VERSION}",
  "testTimestamp": "$(date -Iseconds)",
  "testDirectory": "${TEST_DIR}",
  "logFile": "${LOG_FILE}",
  "opencodePid": ${OPENCODE_PID:-null},
  "results": {
    "serverStarted": ${SERVER_STARTED},
    "pluginLoaded": ${PLUGIN_LOADED},
    "opencodeRunning": ${OPENCODE_RUNNING},
    "assetsRouteTestSuccess": ${ASSETS_TEST_SUCCESS},
    "overallStatus": "${OVERALL_STATUS}"
  },
  "environment": {
    "bunVersion": "$(bun --version)",
    "workingDirectory": "$(pwd)"
  }
}
EOF

log_success "Test report saved to: $(pwd)/test-report.json"

# --- 8. Show Log Summary ---
log_info "Recent log output (last 15 lines):"
echo "─────────────────────────────────────────────────────────────"
tail -15 "$LOG_FILE" 2>/dev/null || echo "Log file not accessible"
echo "─────────────────────────────────────────────────────────────"

# --- 9. Final Status ---
echo
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                  🧪 OPENCODE PLUGIN TEST 🧪                     ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║ Package: ${PACKAGE_NAME}@${PACKAGE_VERSION}                      ║"
echo "║ Status:  ${OVERALL_STATUS}                                          ║"
echo "║ Server:  ${SERVER_STARTED}$(printf "%*s" $((26 - ${#SERVER_STARTED})) "")║"
echo "║ Plugin:  ${PLUGIN_LOADED}$(printf "%*s" $((26 - ${#PLUGIN_LOADED})) "")║"
echo "║ OpenCode:${OPENCODE_RUNNING}$(printf "%*s" $((26 - ${#OPENCODE_RUNNING})) "")║"
echo "║ Assets:  ${ASSETS_TEST_SUCCESS}$(printf "%*s" $((26 - ${#ASSETS_TEST_SUCCESS})) "")║"
echo "║ PID:     ${OPENCODE_PID}$(printf "%*s" $((26 - ${#OPENCODE_PID})) "")║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo

if [[ "$OVERALL_STATUS" == "PASSED" ]]; then
    log_success "🎉 Plugin test PASSED! Plugin is loading correctly in OpenCode."
else
    log_warn "⚠️ Plugin test FAILED! Check the logs above for issues."
fi

# Exit with appropriate code
[[ "$OVERALL_STATUS" == "PASSED" ]] && exit 0 || exit 1
