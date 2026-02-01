# Quality Tools Guide

This guide explains how to run the code quality tools in this project using Bun.

## Available Quality Scripts

### Individual Tools

#### Linting

```bash
bun run lint
```

Runs ESLint on TypeScript, TSX, JavaScript, and JSX files to check for code quality issues and potential bugs.

#### Formatting Check

```bash
bun run format:check
```

Uses Prettier to verify that all files are properly formatted according to the project's style guidelines.

#### Type Checking

```bash
bun run typecheck
```

Runs TypeScript compiler in check mode (`tsc --noEmit`) to verify type correctness without emitting files.

### Combined Quality Check

#### Quality Suite

```bash
bun run quality
```

Runs all quality tools in sequence:

- Linting (`bun run lint`)
- Formatting check (`bun run format:check`)
- Type checking (`bun run typecheck`)

This is the recommended command for daily development to ensure code quality.

### CI Pipeline

#### Full CI Check

```bash
bun run ci
```

Runs the complete CI pipeline:

- All quality tools (`bun run quality`)
- All tests (`bun run test:all` - unit + E2E tests)

Use this before pushing code or in CI/CD pipelines.

## Fixing Issues

### Auto-fix Linting Issues

```bash
bun run lint:fix
```

Attempts to automatically fix ESLint issues where possible.

### Auto-format Code

```bash
bun run format
```

Uses Prettier to automatically format all files in the project.

## Common Issues and Solutions

### ESLint Warnings

- Many warnings are about using `any` types in TypeScript
- Consider replacing `any` with more specific types for better type safety
- Use `bun run lint:fix` to auto-fix formatting-related issues

### Prettier Formatting

- If `bun run format:check` fails, run `bun run format` to auto-format
- Check `.prettierrc` or `prettier.config.js` for formatting rules

### TypeScript Errors

- Run `bun run typecheck` to see detailed error messages
- Common issues: missing type annotations, incorrect imports
- Use TypeScript's error messages to guide fixes

## Integration with Development Workflow

### Before Committing

Always run the quality suite before committing:

```bash
bun run quality
```

### Pre-commit Hooks

Consider setting up pre-commit hooks to automatically run quality checks.

### CI/CD Integration

The `bun run ci` command is designed for CI/CD pipelines and includes both quality checks and comprehensive testing.

## Tool Configuration

- **ESLint**: Configured in `.eslintrc.js` or similar
- **Prettier**: Configured in `.prettierrc` or `prettier.config.js`
- **TypeScript**: Configured in `tsconfig.json`

For more details on tool-specific configuration and rules, check the respective config files in the project root.
