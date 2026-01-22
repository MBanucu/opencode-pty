# Workspace Cleanup and Improvement Report

## Overview
Analysis of the opencode-pty workspace (branch: web-ui-implementation) conducted on January 22, 2026. The workspace is a TypeScript project using Bun runtime, providing OpenCode plugin functionality for interactive PTY management.

## Current State Summary
- **Git Status**: Working tree clean
- **TypeScript**: Has compilation errors preventing builds
- **Tests**: 50 passed, 15 failed, 6 skipped, 2 errors (65 total tests)
- **Dependencies**: Multiple packages are outdated
- **Build Status**: TypeScript errors block compilation

## Cleanup Tasks

### 1. **Critical: Fix TypeScript Errors** (High Priority)
**Status**: Blocking builds and development

**Issues**:
- Duplicate `createLogger` import in `src/plugin/pty/manager.ts` (lines 2 and 11)
- Missing `OpencodeClient` type import from `@opencode-ai/sdk`

**Impact**: Prevents `bun run typecheck` from passing, blocks builds

### 2. **Remove Committed Test Artifacts**
**Files to remove**:
- `playwright-report/index.html` (524KB HTML report)
- `test-results/.last-run.json` (test metadata)

**Reason**: These are generated test outputs that shouldn't be version controlled

### 3. **Test Directory Structure Clarification**
**Current structure**:
- `test/` - Unit/integration tests (6 files)
- `tests/e2e/` - End-to-end tests (2 files)

**Issue**: Inconsistent naming and unclear organization

**Recommendation**: Consolidate under `tests/` with subdirectories:
```
tests/
├── unit/
├── integration/
└── e2e/
```

### 4. **Address Skipped Tests**
**Count**: 6 tests skipped across 3 files

**Root causes**:
- Test framework mismatch (Bun vs Vitest/Playwright)
- Missing DOM environment for React Testing Library
- Playwright configuration conflicts

**Current skip locations**:
- `src/web/components/App.integration.test.tsx`: 2 tests
- `src/web/components/App.e2e.test.tsx`: 1 test suite

## Improvements

### 1. **Test Framework Unification** (High Priority)
**Current problem**: Mixed test environments causing failures

**Options**:
1. **Vitest + happy-dom**: Consistent with current React tests
2. **Playwright only**: Leverage built-in browser environment for all UI tests
3. **Bun + jsdom polyfill**: Maintain Bun but add DOM support

**Recommended**: Switch to Playwright for all UI tests to eliminate environment mismatches

### 2. **Dependency Updates**
**Critical updates needed**:
- `@opencode-ai/plugin`: 1.1.3 → 1.1.31
- `@opencode-ai/sdk`: 1.1.3 → 1.1.31
- `bun-pty`: 0.4.2 → 0.4.8

**Major version updates available**:
- `react`: 18.3.1 → 19.2.3 (major)
- `react-dom`: 18.3.1 → 19.2.3 (major)
- `vitest`: 1.6.1 → 4.0.17 (major)
- `vite`: 5.4.21 → 7.3.1 (major)

**Testing libraries**:
- `@testing-library/react`: 14.3.1 → 16.3.2
- `jsdom`: 23.2.0 → 27.4.0

### 3. **CI/CD Pipeline Updates**
**File**: `.github/workflows/release.yml`

**Issues**:
- Uses Node.js instead of Bun
- npm commands instead of bun
- May not handle Bun's lockfile properly

**Required changes**:
- Switch to `bun` commands
- Update setup-node to setup-bun
- Verify Bun compatibility with publishing workflow

### 4. **Build Process Standardization**
**Current scripts**:
```json
"build": "tsc && vite build",
"typecheck": "tsc --noEmit"
```

**Issues**:
- No clean script for build artifacts
- Build process not optimized for Bun

**Recommendations**:
- Add `clean` script: `rm -rf dist`
- Consider Bun's native TypeScript support
- Add prebuild typecheck

### 5. **Code Quality Tools**
**Current state**: No linting configured (per AGENTS.md)

**Recommendations**:
- Add ESLint with TypeScript support
- Configure Prettier for code formatting
- Add pre-commit hooks for quality checks
- Consider adding coverage reporting

### 6. **Documentation Updates**
**Files needing updates**:
- `README.md`: Update setup and usage instructions
- `AGENTS.md`: Review for outdated information
- Add test directory documentation
- Document local development setup

## Implementation Priority

### Phase 1: Critical Fixes (Immediate)
1. Fix TypeScript errors in manager.ts
2. Remove committed test artifacts
3. Update core dependencies (OpenCode packages)

### Phase 2: Test Infrastructure (Week 1)
1. Choose and implement unified test framework
2. Fix e2e test configurations
3. Re-enable skipped tests

### Phase 3: Build & CI (Week 2)
1. Update CI pipeline for Bun
2. Standardize build scripts
3. Add code quality tools

### Phase 4: Maintenance (Ongoing)
1. Update remaining dependencies
2. Improve documentation
3. Add performance monitoring

## Risk Assessment

### High Risk
- React 19 upgrade (breaking changes possible)
- Test framework unification (extensive test rewriting)

### Medium Risk
- CI pipeline changes (deployment impact)
- Major dependency updates

### Low Risk
- TypeScript fixes
- Documentation updates
- Build script improvements

## Success Metrics
- All TypeScript errors resolved
- 100% test pass rate (0 failures, 0 skips)
- CI pipeline passes with Bun
- No committed build artifacts
- Updated dependencies without breaking changes

## Next Steps
1. **Immediate**: Fix TypeScript errors to enable builds
2. **Short-term**: Choose test framework strategy
3. **Medium-term**: Update CI and dependencies
4. **Long-term**: Add quality tools and monitoring

---

*Report generated: January 22, 2026*
*Workspace: opencode-pty (web-ui-implementation branch)*