# AGENTS.md

This document is the authoritative and up-to-date guide for both agentic coding assistants and developers working with this repository. It contains essential information, conventions, troubleshooting, workflow guidance, and up-to-date instructions reflecting the current codebase and recommended practices.

**opencode-pty** is an OpenCode/Bun plugin enabling interactive management of PTY (pseudo-terminal) sessions from both APIs and a modern web UI. It supports concurrent shell sessions, interactive input/output, real-time streaming, regex output filtering, buffer management, status/exits, permission-aware process handling, and agent/plugin extensibility.

## Documentation Sections

- [Quickstart](./quickstart.md) - Installation, usage, and development setup
- [Architecture](./architecture.md) - Project structure and terminal system architecture
- [Commands](./commands.md) - Development, build, test, and quality check scripts
- [Code Style](./code-style.md) - Naming conventions, TypeScript config, formatting, and documentation standards
- [Testing](./testing.md) - Unit tests, E2E tests, and testing policies
- [Security](./security.md) - Security best practices and guidelines
- [Dependencies](./dependencies.md) - Package management and dependency updates
- [Release](./release.md) - Release process and workflow
- [Contributing](./contributing.md) - Contribution guidelines and PR requirements
- [Troubleshooting](./troubleshooting.md) - Common issues and debugging

## Appendix

### Minimal .opencode/package.json

For local plugin development, create a minimal `package.json` in `.opencode/`:

```json
{
  "name": "opencode-local-plugins",
  "private": true,
  "dependencies": {
    "your-plugin-dep": "^1.0.0"
  }
}
```

Then run `bun install` in `.opencode/` and restart OpenCode.
