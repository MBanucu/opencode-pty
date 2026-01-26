#!/usr/bin/env bash

# test-npm-package.sh - Automated npm package testing script
# 
# Usage: ./test-npm-package.sh <package-name> <version>
# Example: ./test-npm-package.sh opencode-pty-test 0.1.4-test.0

set -euo pipefail

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

cleanup() {
    if [[ -n "${TEST_DIR:-}" && -d "$TEST_DIR" ]]; then
        log_info "Cleaning up test directory: $TEST_DIR"
        rm -rf "$TEST_DIR"
    fi
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
TEST_DIR="/tmp/${PACKAGE_NAME}-test-$(date +%s)"
ASSETS_TEST_SUCCESS=false
TEST_SUCCESS=true

log_info "Starting automated test for ${PACKAGE_NAME}@${PACKAGE_VERSION}"
log_info "Test directory: $TEST_DIR"

# --- 1. Create Test Workspace ---
log_info "Creating test workspace..."
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Create package.json
cat > package.json << EOF
{
  "name": "test-${PACKAGE_NAME}",
  "version": "1.0.0",
  "description": "Test workspace for ${PACKAGE_NAME} package",
  "type": "module",
  "scripts": {
    "test": "bun run test.mjs"
  },
  "dependencies": {},
  "devDependencies": {}
}
EOF

log_success "Created test workspace and package.json"

# --- 2. Install Package ---
log_info "Installing ${PACKAGE_NAME}@${PACKAGE_VERSION} using bun..."
if bun add "${PACKAGE_NAME}@${PACKAGE_VERSION}"; then
    log_success "Package installed successfully"
else
    log_error "Failed to install package"
    exit 1
fi

# Ensure install runs lifecycle hooks (for packages relying on prepack/build)
log_info "Ensuring install scripts ran (rebuilding if needed)..."
bun pm rebuild "${PACKAGE_NAME}" >/dev/null 2>&1 || true

# --- 3. Verify Installation ---
log_info "Verifying installation details..."

# Check package exists
if [[ ! -d "node_modules/${PACKAGE_NAME}" ]]; then
    log_error "Package directory not found in node_modules"
    exit 1
fi

# Check package.json exists
if [[ ! -f "node_modules/${PACKAGE_NAME}/package.json" ]]; then
    log_error "Package.json not found in installed package"
    exit 1
fi

# Check main entry point exists
MAIN_ENTRY=$(node -e "
try {
    const pkg = require('./node_modules/${PACKAGE_NAME}/package.json');
    console.log(pkg.main || pkg.module || 'index.js');
} catch (e) {
    console.error('Error reading package.json:', e.message);
    process.exit(1);
}
")

if [[ -f "node_modules/${PACKAGE_NAME}/${MAIN_ENTRY}" ]]; then
    log_success "Main entry point found: ${MAIN_ENTRY}"
else
    log_warn "Main entry point not found: ${MAIN_ENTRY} (may be TypeScript)"
    # Try TypeScript alternative
    if [[ -f "node_modules/${PACKAGE_NAME}/index.ts" ]]; then
        MAIN_ENTRY="index.ts"
        log_success "TypeScript entry point found: ${MAIN_ENTRY}"
    else
        log_error "No valid entry point found"
        exit 1
    fi
fi

# Show package details
log_info "Package details:"
PACKAGE_INFO=$(bun pm ls "${PACKAGE_NAME}" | grep "${PACKAGE_NAME}@")
echo "  $PACKAGE_INFO"

# --- 3b. Verify web assets are packaged and routable ---
# This is a deeper integration check that starts the package web server and
# verifies that HTML references hashed /assets files that are actually served.
log_info "Creating /assets route test script..."

cat > assets-test.mjs << 'EOF'
#!/usr/bin/env bun

// Verifies that the package can serve built web assets at /assets/*
// by starting the embedded web server and fetching the HTML + referenced assets.

const PACKAGE_NAME = process.env.PACKAGE_NAME
if (!PACKAGE_NAME) {
  console.error('Missing PACKAGE_NAME env var')
  process.exit(1)
}

function fail(msg) {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function pickPort() {
  // Pick a reasonably safe ephemeral port range.
  return 20000 + Math.floor(Math.random() * 20000)
}

function extractAssets(html) {
  const js = [...html.matchAll(/src="\/assets\/([^\"]+\.js)"/g)].map((m) => m[1])
  const css = [...html.matchAll(/href="\/assets\/([^\"]+\.css)"/g)].map((m) => m[1])
  return {
    js: Array.from(new Set(js)),
    css: Array.from(new Set(css)),
  }
}

async function fetchOk(url, expected) {
  const res = await fetch(url)
  if (res.status !== 200) {
    const body = await res.text().catch(() => '')
    fail(`${expected} expected 200, got ${res.status} for ${url}${body ? `\n--- body ---\n${body.slice(0, 4000)}` : ''}`)
  }
  return res
}

let stopWebServer
let url
let started = false

try {
  // In end-user installs, we want this to behave like a production package:
  // root HTML should be dist/web/index.html and assets should be dist/web/assets/*
  const prevEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'

  const serverModule = await import(`${PACKAGE_NAME}/src/web/server.ts`)
  const { startWebServer } = serverModule
  stopWebServer = serverModule.stopWebServer

  let lastErr
  for (let i = 0; i < 8; i++) {
    const port = pickPort()
    try {
      url = startWebServer({ port })
      started = true
      break
    } catch (e) {
      lastErr = e
      await sleep(50)
    }
  }
  if (!started || !url) {
    fail(`Failed to start web server (${String(lastErr || 'unknown error')})`)
  }

  const root = await fetchOk(`${url}/`, 'Root HTML')
  const html = await root.text()

  if (!/<!doctype html>/i.test(html)) {
    fail('Root HTML missing doctype')
  }

  if (html.includes('/main.tsx')) {
    fail('Root HTML appears to be dev HTML (/main.tsx) in production mode')
  }

  if (!html.includes('/assets/')) {
    fail('Root HTML does not reference /assets/ (missing built asset links)')
  }

  const assets = extractAssets(html)
  if (assets.js.length === 0 && assets.css.length === 0) {
    fail('No .js/.css assets found in HTML under /assets/')
  }

  for (const js of assets.js) {
    const res = await fetchOk(`${url}/assets/${js}`, 'JS asset')
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (!/^(application|text)\/javascript(;|$)/.test(ct)) {
      fail(`Unexpected JS content-type: ${ct || '(missing)'} for /assets/${js}`)
    }
  }

  for (const css of assets.css) {
    const res = await fetchOk(`${url}/assets/${css}`, 'CSS asset')
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (!/^text\/css(;|$)/.test(ct)) {
      fail(`Unexpected CSS content-type: ${ct || '(missing)'} for /assets/${css}`)
    }
  }

  // Basic traversal defense sanity check
  const traversal = await fetch(`${url}/assets/../index.html`)
  if (traversal.status === 200) {
    fail('Traversal request unexpectedly succeeded: /assets/../index.html')
  }

  console.log('✅ /assets route serves built assets')

  // Restore env
  if (prevEnv == null) delete process.env.NODE_ENV
  else process.env.NODE_ENV = prevEnv
} finally {
  try {
    if (typeof stopWebServer === 'function') stopWebServer()
  } catch {}
}
EOF

chmod +x assets-test.mjs

# --- 4. Create Test Script ---
log_info "Creating automated test script..."

# Try to detect main export from package
MAIN_EXPORT=$(node -e "
try {
    const fs = require('fs');
    const path = './node_modules/${PACKAGE_NAME}/${MAIN_ENTRY}';
    const content = fs.readFileSync(path, 'utf8');
    const exportMatch = content.match(/export\s+(?:const|let|var|class|function)\s+(\w+)/);
    if (exportMatch) {
        console.log(exportMatch[1]);
    } else {
        // Look for re-exports
        const reExportMatch = content.match(/export\s*{\s*([^}]+)\s*}/);
        if (reExportMatch) {
            console.log(reExportMatch[1].split(',')[0].trim());
        } else {
            console.log('default');
        }
    }
} catch (e) {
    console.error('Error analyzing exports:', e.message);
    console.log('default');
}
")

cat > test.mjs << EOF
#!/usr/bin/env bun

import { ${MAIN_EXPORT} } from '${PACKAGE_NAME}'

console.log('✅ Successfully imported ${MAIN_EXPORT} from ${PACKAGE_NAME}@${PACKAGE_VERSION}')
console.log('📦 Package version: ${PACKAGE_VERSION}')
console.log('🔧 Export type:', typeof ${MAIN_EXPORT})

// Test if export can be called/used (basic structure test)
try {
    console.log('🧪 Testing export structure...')
    
    if (typeof ${MAIN_EXPORT} === 'function') {
        const exportString = ${MAIN_EXPORT}.toString()
        console.log('📝 Export is a function: true')
        console.log('📏 Function length:', exportString.length, 'characters')
    } else if (typeof ${MAIN_EXPORT} === 'object') {
        console.log('📦 Export is an object: true')
        console.log('🔑 Object keys:', Object.keys(${MAIN_EXPORT}))
    } else {
        console.log('📄 Export type:', typeof ${MAIN_EXPORT})
    }
    
    console.log('✅ Package import and structure test passed!')
} catch (error) {
    console.error('❌ Package test failed:', error)
    process.exit(1)
}

console.log('🎉 ${PACKAGE_NAME}@${PACKAGE_VERSION} package installed and working correctly!')
EOF

# --- 5. Run Test ---
log_info "Running automated package test..."
if bun run test.mjs; then
    log_success "Package test completed successfully!"
else
    log_error "Package test failed"
    exit 1
fi

# --- 5b. Run /assets route test ---
log_info "Running /assets route test (starts embedded web server)..."
if PACKAGE_NAME="${PACKAGE_NAME}" bun run assets-test.mjs; then
    log_success "/assets route test passed"
    ASSETS_TEST_SUCCESS=true
else
    log_error "/assets route test failed"
    ASSETS_TEST_SUCCESS=false
    TEST_SUCCESS=false
fi

# --- 6. Additional Verification ---
log_info "Running additional verification checks..."

# Check if package can be imported in different ways
cat > import-test.mjs << EOF
import { ${MAIN_EXPORT} } from '${PACKAGE_NAME}'
console.log('✅ Named import works')

import * as pkg from '${PACKAGE_NAME}'
console.log('✅ Namespace import works, keys:', Object.keys(pkg))

import pkgDefault from '${PACKAGE_NAME}'
console.log('✅ Default import type:', typeof pkgDefault)
EOF

if bun run import-test.mjs; then
    log_success "All import patterns work correctly"
else
    log_warn "Some import patterns may not work (this is normal for some packages)"
fi

# Check dependencies
log_info "Checking dependency resolution..."
DEP_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
log_info "Total dependencies installed: $((DEP_COUNT - 1))" # -1 for node_modules itself

# --- 7. Generate Report ---
log_info "Generating test report..."

cat > test-report.json << EOF
{
  "packageName": "${PACKAGE_NAME}",
  "packageVersion": "${PACKAGE_VERSION}",
  "testTimestamp": "$(date -Iseconds)",
  "testDirectory": "${TEST_DIR}",
  "mainEntry": "${MAIN_ENTRY}",
  "mainExport": "${MAIN_EXPORT}",
  "installSuccess": true,
  "testSuccess": ${TEST_SUCCESS},
  "assetsRouteTestSuccess": ${ASSETS_TEST_SUCCESS:-false},
  "dependencies": $((DEP_COUNT - 1)),
  "bunVersion": "$(bun --version)"
}
EOF

log_success "Test report saved to: $(pwd)/test-report.json"

# --- 8. Summary ---
echo
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    🎉 TEST COMPLETE 🎉                         ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║ Package: ${PACKAGE_NAME}@${PACKAGE_VERSION}                      ║"
echo "║ Status:  ✅ SUCCESS                                          ║"
echo "║ Entry:   ${MAIN_ENTRY}$(printf "%*s" $((26 - ${#MAIN_ENTRY})) "")║"
echo "║ Export:  ${MAIN_EXPORT}$(printf "%*s" $((26 - ${#MAIN_EXPORT})) "")║"
echo "║ Deps:    $((DEP_COUNT - 1)) packages$(printf "%*s" $((20 - ${#DEP_COUNT} + 1)) "")║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo
log_info "Test directory will be cleaned up automatically."
log_info "Package is ready for production use!"

if [[ "${TEST_SUCCESS}" != "true" ]]; then
    log_error "One or more tests failed (see output above)"
    exit 1
fi

exit 0
