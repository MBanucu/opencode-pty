# Troubleshooting

## Common Issues

### Build Failures

- **Type errors**: Run `bun run typecheck` to identify issues
- **Lint errors**: Use `bun run lint:fix` for auto-fixable issues
- **Missing dependencies**: Run `bun install` to ensure all packages installed

### Test Failures

- **Unit tests**: Check for race conditions or state leakage between tests
- **E2E tests**: Verify dev server running, check browser console for errors
- **Flaky tests**: Increase timeouts or add explicit waits

### Runtime Issues

- **Permission denied**: Check PTY session permissions in OpenCode settings
- **Session not found**: Verify session ID and lifecycle
- **Buffer issues**: Check buffer size limits and regex patterns

### Development Environment

- **Bun version**: Ensure Bun latest version installed
- **Node modules**: Clear cache with `rm -rf node_modules && bun install`
- **Port conflicts**: Check if dev server ports (8766) are available

## Debug Mode

- Enable verbose logging: `opencode --log-level DEBUG --print-logs`
- Check debug logs in `~/.local/share/opencode/logs/`
- Use browser dev tools for WebSocket debugging

## Error Handling & Logging

### Error Handling Patterns

- Use try/catch blocks for operations that may fail
- Throw descriptive `Error` objects with clear messages
- Handle errors gracefully in async operations
- Validate inputs and provide meaningful error messages
- Use custom error builders for common error types (e.g., `buildSessionNotFoundError`)

### Logging Approach

- Logging is handled through the OpenCode client's notification system
- Use `client.session.promptAsync()` for user-facing notifications
- Session lifecycle events (start, exit) generate notifications automatically
- No dedicated logging files; logging is integrated with OpenCode's session system
- Debug logging can be enabled via OpenCode's `--log-level DEBUG` flag

### Exception Safety

- Operations that modify state should be atomic where possible
- Clean up resources in error paths (session cleanup, buffer management)
- Silent failure in notification paths to prevent cascading errors
- Validate session state before operations
