# Dependencies

## Package Management

- **Runtime**: Bun for fast package management and execution
- **Dependencies**: Listed in `package.json` with specific versions
- **Lockfile**: `bun.lockb` ensures reproducible installs
- **Peer Dependencies**: TypeScript ^5 required

## Key Dependencies

- `@opencode-ai/plugin` & `@opencode-ai/sdk` — OpenCode integration
- `@xterm/xterm` & `@xterm/addon-*` — Terminal emulation
- `bun-pty` — PTY process management
- `react` & `react-dom` — Web UI framework
- `strip-ansi` — ANSI escape sequence removal

## Development Dependencies

- Testing: `@playwright/test`, Bun test runner
- Code Quality: `eslint`, `prettier`, `typescript`
- Build: `vite`, `@vitejs/plugin-react`

## Updating Dependencies

- Use `bun update <package>` for specific package updates
- Run full test suite after updates
- Check for breaking changes in changelogs
- Update lockfile and commit together
