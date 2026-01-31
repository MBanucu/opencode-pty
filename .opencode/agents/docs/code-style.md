# Code Style

## Naming Conventions

- **Functions/Variables**: camelCase (`setOnSessionUpdate`, `rawOutputCallbacks`)
- **Types/Classes**: PascalCase (`PTYManager`, `SessionLifecycleManager`)
- **Constants**: UPPER_CASE (`DEFAULT_READ_LIMIT`, `MAX_LINE_LENGTH`)
- **Directories**: kebab-case (`src/web/client`, `e2e`)
- **Files**: kebab-case for directories, camelCase for components/hooks (`useWebSocket.ts`, `TerminalRenderer.tsx`)

## TypeScript Configuration

- Strict TypeScript settings enabled (`strict: true`)
- Module resolution: `"bundler"` with `"moduleResolution": "bundler"`
- Target: ESNext with modern features
- No implicit returns or unused variables/parameters allowed
- Explicit type annotations required where beneficial

## Formatting (Prettier)

- **Semicolons**: Disabled (`semi: false`)
- **Quotes**: Single quotes preferred (`singleQuote: true`)
- **Trailing commas**: ES5 style (`trailingComma: "es5"`)
- **Print width**: 100 characters (`printWidth: 100`)
- **Indentation**: 2 spaces, no tabs (`tabWidth: 2`, `useTabs: false`)

## Import/Export Style

- Use ES6 imports/exports
- Group imports: external libraries first, then internal modules
- Prefer named exports over default exports for better tree-shaking
- Use absolute imports for internal modules where possible

## Documentation

- Use JSDoc comments for public APIs
- Inline comments for complex logic
- No redundant comments on self-explanatory code
