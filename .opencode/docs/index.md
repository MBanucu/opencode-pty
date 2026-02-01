# OpenCode PTY Documentation

This documentation covers the development of a Bun-based terminal application with PTY management, focusing on code quality, testing strategies, and modern JavaScript patterns.

## Contents

- **[Session Report](session-report.md)**: Latest implementation session - hybrid WebSocket+HTTP input transmission
- **[TypeScript](typescript/)**: Type safety patterns, best practices, and case studies
- **[Testing](test/)**: Unit tests, DOM testing, and E2E testing with Bun and Playwright
- **[Quality Tools](quality-tools.md)**: Linting, type checking, and CI/CD integration

## Recent Achievements

- **Type Safety**: Eliminated 11 `@typescript-eslint/no-explicit-any` warnings (41 → 30)
- **Input Architecture**: Implemented hybrid WebSocket-first with HTTP fallback (25% latency reduction)
- **Test Suite**: 76 E2E tests passing after removing obsolete HTTP interception tests
- **Documentation**: Restructured for maintainability with files under 150 lines

## Key Technologies

- **Bun**: Fast JavaScript runtime with native testing and build tools
- **TypeScript**: Strict type checking with modern patterns
- **WebSocket**: Real-time communication with fallback mechanisms
- **React**: Frontend with xterm.js integration
- **Playwright**: E2E testing with comprehensive browser automation
- **PTY Management**: Cross-platform terminal session handling

## Development Workflow

1. **Code Changes**: Implement features with proper typing
2. **Quality Checks**: Run `bun run quality` (lint + typecheck + format)
3. **Unit Tests**: Execute `bun test` for fast feedback
4. **E2E Tests**: Run `bun run test:all` before PRs
5. **Documentation**: Update docs for new patterns and lessons learned

---

_For complete project documentation, see the [README](../README.md)_
