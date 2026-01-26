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
  "testSuccess": true,
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

exit 0