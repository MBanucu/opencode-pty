# AGENTS.md

## Project Overview
This is the `opencode-pty` project, an OpenCode plugin providing interactive pseudo-terminal (PTY) management for background processes, interactive input, and real-time output streaming. It supports dev servers, watch modes, long-running processes, and REPLs that synchronous tools cannot handle.

**Languages/Frameworks**: TypeScript, Bun runtime, Biome for linting/formatting, Vite for building, React for web UI, Playwright for e2e tests, Nix/Devenv for development environment.

**Key Directories**:
- `src/plugin/`: Core plugin logic (tools, managers, PTY operations)
- `src/web/`: React-based web UI for session monitoring
- `src/shared/`: Shared utilities and types
- `test/`: Unit and e2e tests
- `dist/`: Built output

## Build/Lint/Test Commands

### Primary Commands
- **Type checking**: `bun typecheck` or `bun run typecheck`
- **Unit tests**: `bun unittest` or `bun test`
- **E2E tests**: `bun test:e2e` (Playwright with Bun)
- **All tests**: `bun test:all`
- **Dev build**: `bun build:dev` (Vite development mode)
- **Prod build**: `bun build:prod` (Vite production build with minification)
- **Clean**: `bun clean` (removes dist/, test-results/, playwright-report/)
- **Lint**: `bun lint` or `biome lint .`
- **Lint fix**: `bun lint:fix` or `biome lint --write .`
- **Format**: `bun format` or `biome format .`
- **Format fix**: `bun format:fix` or `biome format --write .`

**Note:** If bun commands fail (e.g., due to dynamic linking issues on NixOS), use the direct biome commands.

### Running Single Tests
To run a specific test file: `bun test path/to/test.ts`

For example:
- `bun test test/plugin/pty-manager.test.ts`
- `bun test test/web/session-list.test.ts`

Use `bun test --watch` for watch mode during development.

### Devenv Aliases
All commands are available as aliases in the Devenv shell (e.g., `typecheck`, `lint`, `test:all`).

## Code Style Guidelines

### General Principles
- Strict TypeScript configuration (`strict: true`)
- No unused locals/parameters
- No implicit returns
- Consistent async/await usage
- Security-first: validate inputs, check permissions
- Functional programming patterns where appropriate

### Imports
- **Grouping**: External libraries first, then relative imports
- **Extensions**: Include `.ts` for TypeScript files (e.g., `import { api } from './api-client.ts'`)
- **Absolute vs Relative**: Prefer absolute imports for internal modules to avoid deep `../` chains
- **Ordering**:
  1. External dependencies (e.g., `import { spawn } from 'bun-pty'`)
  2. Shared modules (e.g., `import { RingBuffer } from '../../shared/ring-buffer.ts'`)
  3. Local modules

Example:
```typescript
import { spawn } from 'bun-pty';
import type { Session } from '../../shared/types.ts';
import { handleError } from '../utils.ts';
```

### Formatting
- **Indentation**: 2 spaces (Biome default)
- **Line length**: 100 characters
- **Quotes**: Single quotes for strings (`'hello'`)
- **Semicolons**: As needed (Biome `asNeeded` setting)
- **Trailing commas**: ES5 style (always for multi-line objects/arrays)
- **Spacing**: Consistent spacing around operators, after commas

### Types and Interfaces
- **Type aliases**: Use `type` for unions, intersections
- **Interfaces**: For object shapes, especially with methods
- **Generics**: Used extensively (e.g., `Promise<T>`, `Array<T>`, `Map<K, V>`)
- **Optional properties**: Use `?` for optional fields
- **Union types**: Prefer over `any` (e.g., `string | number | null`)

Examples:
```typescript
type SessionStatus = 'running' | 'exited' | 'killed';
interface PTYSession {
  id: string;
  status: SessionStatus;
  pid?: number;
  buffer: RingBuffer<string>;
}
```

### Naming Conventions
- **Variables/Functions**: camelCase (`activeSession`, `handleInput`)
- **Classes/Components**: PascalCase (`RingBuffer`, `SessionList`)
- **Files**: kebab-case for directories, camelCase for files (`session-manager.ts`, `web-socket.ts`)
- **Constants**: UPPER_SNAKE_CASE (`PTY_MAX_BUFFER_LINES`, `DEFAULT_TIMEOUT`)
- **Enums**: PascalCase (`enum ExitCode { Success = 0, Failure = 1 }`)
- **Types**: PascalCase (`type ApiResponse<T> = ...`)

### Error Handling
- **Try/Catch**: Use for async operations and risky code
- **Custom Errors**: Throw `new Error('descriptive message')`
- **Propagation**: Let errors bubble up unless handled locally
- **Validation**: Check inputs early, throw descriptive errors
- **Permissions**: Respect OpenCode's bash permissions, show toast notifications for denials

Example:
```typescript
try {
  const session = await manager.spawn(options);
  return session;
} catch (error) {
  throw new Error(`Failed to spawn PTY session: ${error.message}`);
}
```

### Comments and Documentation
- **Inline comments**: `//` for complex logic explanations
- **JSDoc**: Rare, used only for public APIs or complex functions
- **TODOs**: Use `// TODO:` for future work
- **Avoid over-commenting**: Code should be self-explanatory

### Async/Await Patterns
- **Preferred**: `await` over `.then()/.catch()`
- **Error handling**: Use try/catch around await
- **Concurrent ops**: Use `Promise.all()` for parallel async calls
- **Timeouts**: Implement with AbortController for cancellable operations

Example:
```typescript
const [output, status] = await Promise.all([
  session.read(),
  session.waitForExit()
]);
```

### File Organization
- **Components**: `src/web/client/components/` (React components)
- **Hooks**: `src/web/client/hooks/` (React hooks)
- **Types**: Separate `.ts` files (e.g., `types.ts`, `session-types.ts`)
- **Utils**: `utils.ts` files for helper functions
- **Tools**: `src/plugin/pty/tools/` for PTY-specific operations
- **Managers**: `manager.ts` for core business logic
- **Tests**: Mirror source structure in `test/`

### Linting and Formatting Rules (Biome)
- **Formatter**: Enabled, enforces consistent style
- **Linting**: Basic rules, no custom overrides
- **VCS integration**: Git-aware formatting
- **File inclusion**: All files except `bun.lock`

## Security Practices
- **Command validation**: Check against OpenCode's bash permission rules
- **Input sanitization**: Regex patterns validated to prevent injection
- **External access**: Controlled via `external_directory` permissions
- **WebSocket security**: Proper connection handling
- **Secrets**: No hard-coded credentials, use environment variables
- **Buffer limits**: Configurable max buffer size to prevent memory issues

## Testing Patterns
- **Framework**: Bun:test (native Bun testing)
- **Structure**: Unit tests for individual functions/classes, e2e for full flows
- **Mocking**: Use `spyOn`, `mockImplementation` for dependencies
- **Setup**: `beforeEach` for test isolation
- **Async tests**: Supported natively
- **Coverage**: Aim for comprehensive path coverage
- **Fixtures**: Use test data helpers for consistency

Example test:
```typescript
import { describe, it, expect, beforeEach } from 'bun:test';

describe('PTYManager', () => {
  let manager: PTYManager;

  beforeEach(() => {
    manager = new PTYManager();
  });

  it('should spawn a new session', async () => {
    const session = await manager.spawn({
      command: 'echo',
      args: ['hello']
    });
    expect(session.id).toBeDefined();
  });
});
```

## Deployment and Release
- **Development**: `bun build:dev` for hot-reload development
- **Production**: `bun build:prod` triggers minified build
- **Packaging**: `npm pack` runs `prepack` script
- **Release process**: `./release.sh` handles versioning, commits, and pushes
- **CI/CD**: GitHub Actions for automated releases
- **Distribution**: NPM package with source and dist files

## Additional Guidelines
- **Performance**: Use efficient data structures (RingBuffer for logs)
- **Memory management**: Limit buffer sizes, clean up resources
- **Real-time updates**: WebSocket for live output streaming
- **Cross-platform**: Handle different OS behaviors in PTY operations
- **Error recovery**: Graceful handling of process failures
- **User feedback**: Toast notifications for errors/warnings
- **Accessibility**: Consider a11y in web UI components