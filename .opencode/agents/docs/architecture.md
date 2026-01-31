# Architecture

## Project Structure (Directory/Files)

- `src/plugin/pty/` — Core PTY logic, types, manager, buffer, permissions, and tools
- `src/web/` — React-based web UI, server, live session and terminal interaction
- `test/` — Unit and agent-facing tests
- `e2e/` — End-to-end (Playwright) tests, for web UI/session validation
- Use camelCase for function/variable names; PascalCase for types/classes; UPPER_CASE for constants; kebab-case for directories.

## Terminal System Architecture

### Core Components

- **`RawTerminal` Component** (`src/web/client/components/TerminalRenderer.tsx`): Single React component handling all terminal rendering and input. Uses xterm.js for terminal emulation with optimized diff-based updates.
- **`useWebSocket` Hook** (`src/web/client/hooks/useWebSocket.ts`): Manages WebSocket connections, handles incoming messages (raw_data, session_update, session_list), and routes data to appropriate handlers.
- **`useSessionManager` Hook** (`src/web/client/hooks/useSessionManager.ts`): Handles session lifecycle, input sending, and session switching with buffer fetching.
- **PTY Manager** (`src/plugin/pty/manager.ts`): Server-side session management, process spawning, and buffer operations.

### Data Flow

1. **Input Flow**: User types → `RawTerminal.onData` → `handleSendInput` → POST `/api/sessions/:id/input` → WebSocket `raw_data` message → `onRawData` callback → `rawOutput` state update → `TerminalRenderer.componentDidUpdate` → xterm.js display
2. **Output Flow**: PTY process output → `SessionLifecycle.onData` → buffer append → WebSocket `raw_data` message → `onRawData` → display update
3. **Session Switching**: Click session → `handleSessionClick` → fetch buffer → replace `rawOutput` state → clear and rewrite terminal

### Key Design Decisions

- **No Local Echo**: Input is sent directly to PTY process; PTY handles all echoing to prevent double characters
- **Diff-Based Updates**: Terminal only writes changed content for performance
- **Single Component**: Simplified from inheritance hierarchy to single `RawTerminal` class
- **WebSocket-Driven**: Real-time updates via WebSocket messages rather than polling
