# Security

## Input Validation

- Validate all user inputs before processing
- Use regex pattern validation for search/filter operations
- Sanitize file paths and command arguments
- Check permissions before executing operations

## Process Security

- PTY sessions run with user permissions only
- External directory access controlled via permission settings
- No elevated privileges or sudo operations
- Session isolation prevents cross-session interference

## Dependency Security

- Regular dependency updates via `bun install`
- CI includes security scanning (CodeQL, dependency review)
- No secrets or credentials committed to repository
- Environment variables used for sensitive configuration

## Code Security

- Strict TypeScript prevents type-related vulnerabilities
- ESLint rules enforce secure coding patterns
- No dynamic code execution or eval usage
- Buffer overflow protection through TypeScript bounds checking
