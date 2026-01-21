# AGENTS.md

This file contains essential information for agentic coding assistants working in this repository.

## Project Overview

**opencode-pty** is an OpenCode plugin that provides interactive PTY (pseudo-terminal) management. It enables AI agents to run background processes, send interactive input, and read output on demand. The plugin supports multiple concurrent PTY sessions with features like output buffering, regex filtering, and permission integration.

## Build/Lint/Test Commands

### Type Checking
```bash
bun run typecheck
```
Runs TypeScript compiler in no-emit mode to check for type errors.

### Testing
```bash
bun test
```
Runs all tests using Bun's test runner.

### Running a Single Test
```bash
bun test --match "test name pattern"
```
Use the `--match` flag with a regex pattern to run specific tests. For example:
```bash
bun test --match "spawn"
```

### Linting
No dedicated linter configured. TypeScript strict mode serves as the primary code quality gate.

## Code Style Guidelines

### Language and Environment
- **Language**: TypeScript 5.x with ESNext target
- **Runtime**: Bun (supports TypeScript directly)
- **Module System**: ES modules with explicit `.ts` extensions in imports
- **JSX**: React JSX syntax (if needed, though this project is primarily backend)

### TypeScript Configuration
- Strict mode enabled (`strict: true`)
- Additional strict flags: `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`, `noImplicitOverride`
- Module resolution: bundler mode
- Verbatim module syntax (no semicolons required)

### Imports and Dependencies
- Use relative imports with `.ts` extensions: `import { foo } from "../foo.ts"`
- Import types explicitly: `import type { Foo } from "./types.ts"`
- Group imports: external dependencies first, then internal
- Avoid wildcard imports (`import * as foo`)

### Naming Conventions
- **Variables/Functions**: camelCase (`processData`, `spawnSession`)
- **Constants**: UPPER_CASE (`DEFAULT_LIMIT`, `MAX_LINE_LENGTH`)
- **Types/Interfaces**: PascalCase (`PTYSession`, `SpawnOptions`)
- **Classes**: PascalCase (`PTYManager`, `RingBuffer`)
- **Enums**: PascalCase (`PTYStatus`)
- **Files**: kebab-case for directories, camelCase for files (`spawn.ts`, `manager.ts`)

### Code Structure
- **Functions**: Prefer arrow functions for tools, regular functions for utilities
- **Async/Await**: Use throughout for all async operations
- **Error Handling**: Throw descriptive Error objects, use try/catch for expected failures
- **Logging**: Use `createLogger` from `../logger.ts` for consistent logging
- **Tool Functions**: Use `tool()` wrapper with schema validation for all exported tools

### Schema Validation
All tool functions must use schema validation:
```typescript
export const myTool = tool({
  description: "Brief description",
  args: {
    param: tool.schema.string().describe("Parameter description"),
    optionalParam: tool.schema.boolean().optional().describe("Optional param"),
  },
  async execute(args, ctx) {
    // Implementation
  },
});
```

### Error Messages
- Be descriptive and actionable
- Include context like session IDs or parameter values
- Suggest alternatives when possible (e.g., "Use pty_list to see active sessions")

### File Organization
```
src/
├── plugin.ts           # Main plugin entry point
├── types.ts            # Plugin-level types
├── logger.ts           # Logging utilities
└── plugin/             # Plugin-specific code
    ├── pty/            # PTY-specific code
    │   ├── types.ts    # PTY types and interfaces
    │   ├── manager.ts  # PTY session management
    │   ├── buffer.ts   # Output buffering (RingBuffer)
    │   ├── permissions.ts # Permission checking
    │   ├── wildcard.ts # Wildcard matching utilities
    │   └── tools/      # Tool implementations
    │       ├── spawn.ts # pty_spawn tool
    │       ├── write.ts # pty_write tool
    │       ├── read.ts  # pty_read tool
    │       ├── list.ts  # pty_list tool
    │       ├── kill.ts  # pty_kill tool
    │       └── *.txt    # Tool descriptions
    └── types.ts         # Plugin types
```

### Constants and Magic Numbers
- Define constants at the top of files: `const DEFAULT_LIMIT = 500;`
- Use meaningful names instead of magic numbers
- Group related constants together

### Buffer Management
- Use RingBuffer for output storage (max 50,000 lines by default via `PTY_MAX_BUFFER_LINES`)
- Handle line truncation at 2000 characters
- Implement pagination with offset/limit for large outputs

### Session Management
- Generate unique IDs using crypto: `pty_${hex}`
- Track session lifecycle: running → exited/killed
- Support cleanup on session deletion events
- Include parent session ID for proper isolation

### Permission Integration
- Always check command permissions before spawning
- Validate working directory permissions
- Use wildcard matching for flexible permission rules

### Testing
- Write tests for all public APIs
- Test error conditions and edge cases
- Use Bun's test framework
- Mock external dependencies when necessary

### Documentation
- Include `.txt` description files for each tool in `tools/` directory
- Use JSDoc sparingly, prefer `describe()` in schemas
- Keep README.md updated with usage examples

### Security Considerations
- Never log sensitive information (passwords, tokens)
- Validate all user inputs, especially regex patterns
- Respect permission boundaries set by OpenCode
- Use secure random generation for session IDs

### Performance
- Use efficient data structures (RingBuffer, Map for sessions)
- Avoid blocking operations in main thread
- Implement pagination for large outputs
- Clean up resources promptly

### Commit Messages
Follow conventional commit format:
- `feat:` for new features
- `fix:` for bug fixes
- `refactor:` for code restructuring
- `test:` for test additions
- `docs:` for documentation changes

### Git Workflow
- Use feature branches for development
- Run typecheck and tests before committing
- Use GitHub Actions for automated releases on main branch
- Follow semantic versioning with `v` prefixed tags

### Dependencies
- **@opencode-ai/plugin**: ^1.1.3 (Core plugin framework)
- **@opencode-ai/sdk**: ^1.1.3 (SDK for client interactions)
- **bun-pty**: ^0.4.2 (PTY implementation)
- **@types/bun**: 1.3.1 (TypeScript definitions for Bun)
- **typescript**: ^5 (peer dependency)

### Development Setup
- Install Bun: `curl -fsSL https://bun.sh/install | bash`
- Install dependencies: `bun install`
- Run development commands: `bun run <script>`

### Nix Development (Alternative)
- Install Nix: `curl -L https://nixos.org/nix/install | sh`
- Enter dev shell: `nix develop`
- Build with bun2nix: `nix run github:nix-community/bun2nix -- -o nix/bun.nix`
- Update flake: `nix flake update`

### Common Patterns
- Use `manager` singleton for PTY operations
- Implement tools as pure functions with side effects through manager
- Handle async operations with proper error propagation
- Use descriptive variable names over abbreviations
- Prefer functional programming where appropriate

### Code Review Checklist
- [ ] TypeScript types are correct and complete
- [ ] Error handling covers expected failure modes
- [ ] Logging is appropriate and not verbose
- [ ] Permission checks are in place
- [ ] Tests exist for new functionality
- [ ] Code follows naming conventions
- [ ] No sensitive data in logs or comments
- [ ] Documentation updated if public API changed

### Troubleshooting
- **Type errors**: Run `bun run typecheck` and fix reported issues
- **Test failures**: Check test output and fix assertions
- **Permission denied**: Verify OpenCode configuration allows the command/directory
- **Session not found**: Use `pty_list` to check active sessions
- **Invalid regex**: Test patterns separately and provide user-friendly error messages

This guide should be updated as the codebase evolves. When adding new features or changing conventions, update this document accordingly.