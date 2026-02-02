# opencode-pty

A plugin for [OpenCode](https://opencode.ai) that provides interactive PTY (pseudo-terminal) management, enabling the AI agent to run background processes, send interactive input, and read output on demand.

## Why?

OpenCode's built-in `bash` tool runs commands synchronously—the agent waits for completion. This works for quick commands, but not for:

- **Dev servers** (`npm run dev`, `cargo watch`)
- **Watch modes** (`npm test -- --watch`)
- **Long-running processes** (database servers, tunnels)
- **Interactive programs** (REPLs, prompts)

This plugin gives the agent full control over multiple terminal sessions, like tabs in a terminal app.

## Features

- **Background Execution**: Spawn processes that run independently
- **Multiple Sessions**: Manage multiple PTYs simultaneously
- **Interactive Input**: Send keystrokes, Ctrl+C, arrow keys, etc.
- **Output Buffer**: Read output anytime with pagination (offset/limit)
- **Pattern Filtering**: Search output using regex (like `grep`)
- **Exit Notifications**: Get notified when processes finish (eliminates polling)
- **Permission Support**: Respects OpenCode's bash permission settings
- **Session Lifecycle**: Sessions persist until explicitly killed
- **Auto-cleanup**: PTYs are cleaned up when OpenCode sessions end
- **Web UI**: Modern React-based interface for session management
- **Real-time Streaming**: WebSocket-based live output updates

## Setup

Add the plugin to your [OpenCode config](https://opencode.ai/docs/config/):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-pty"]
}
```

That's it. OpenCode will automatically install the plugin on next run.

## Updating

> [!WARNING]
> OpenCode does NOT auto-update plugins.

To get the latest version, clear the cached plugin and let OpenCode reinstall it:

```bash
rm -rf ~/.cache/opencode/node_modules/opencode-pty
opencode
```

## Tools Provided

| Tool        | Description                                                                 |
| ----------- | --------------------------------------------------------------------------- |
| `pty_spawn` | Create a new PTY session (command, args, workdir, env, title, notifyOnExit) |
| `pty_write` | Send input to a PTY (text, escape sequences like `\x03` for Ctrl+C)         |
| `pty_read`  | Read output buffer with pagination and optional regex filtering             |
| `pty_list`  | List all PTY sessions with status, PID, line count                          |
| `pty_kill`  | Terminate a PTY, optionally cleanup the buffer                              |

## Slash Commands

This plugin provides slash commands that can be used in OpenCode chat:

| Command           | Description                                        |
| ----------------- | -------------------------------------------------- |
| `/pty-server-url` | Get the URL of the running PTY web server instance |

## Web UI

This plugin includes a modern React-based web interface for monitoring and interacting with PTY sessions.

[![opencode-pty Web UI Demo](https://img.youtube.com/vi/wPqmTPnzvVY/0.jpg)](https://youtu.be/wPqmTPnzvVY)

If you instruct the coding agent to run something in background, you have to name it "session",
i.e. "run xy as a background SESSION".
If you name it "task" or "process" or anything else, the agent will sometimes run it as background subprocess using `&`.

### Starting the Web UI

1. Run opencode with the plugin.
2. Run slash command `/pty-server-url`.

Opencode will load the plugin.
The plugin will start the server and provide the slash command.
The port is not fixed.
Every process instance of opencode will start a new server with unique random (but still free) port on localhost.
The origin of the printed URL provided by the slash command will route to the static `index.html` (client).
The `index.html` loads the javascript files, that build the client in the browser.
The client will use a websocket and http (REST API) requests to communicate with the server, depending on latency, reliability and reactivity.
The server subscribes to the events of the base (session creation, new output of pty session).
The client subscribes to the events of the server (bun pub/sub via websocket).
Everything is event driven, reliable (if you can call websocket communication reliable) and reactive (using react as client builder).

### Features

- **Session List**: View all active PTY sessions with status indicators
- **Real-time Output**: Live streaming of process output via WebSocket
- **Interactive Input**: Send commands and input to running processes
- **Session Management**: Kill sessions directly from the UI
- **Connection Status**: Visual indicator of WebSocket connection status

### REST API

The web server provides a REST API for session management:

| Method   | Endpoint                         | Description                                                                 |
| -------- | -------------------------------- | --------------------------------------------------------------------------- |
| `GET`    | `/api/sessions`                  | List all PTY sessions                                                       |
| `POST`   | `/api/sessions`                  | Create a new PTY session                                                    |
| `GET`    | `/api/sessions/:id`              | Get session details                                                         |
| `POST`   | `/api/sessions/:id/input`        | Send input to a session                                                     |
| `DELETE` | `/api/sessions/:id`              | Kill a session (without cleanup)                                            |
| `DELETE` | `/api/sessions/:id/cleanup`      | Kill and cleanup a session                                                  |
| `GET`    | `/api/sessions/:id/buffer/plain` | Get session output buffer (returns `{ plain: string, byteLength: number }`) |
| `GET`    | `/api/sessions/:id/buffer/raw`   | Get session output buffer (raw data)                                        |
| `DELETE` | `/api/sessions`                  | Clear all sessions                                                          |
| `GET`    | `/health`                        | Server health check with metrics                                            |

#### Session Creation

```bash
curl -X POST http://localhost:[PORT]/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "command": "bash",
    "args": ["-c", "echo hello && sleep 10"],
    "description": "Test session"
  }'
```

Replace `[PORT]` with the actual port number shown in the server console output.

#### WebSocket Streaming

Connect to `/ws` for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:[PORT]/ws')

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  if (data.type === 'raw_data') {
    console.log('New output:', data.rawData)
  } else if (data.type === 'session_list') {
    console.log('Session list:', data.sessions)
  }
}
```

Replace `[PORT]` with the actual port number shown in the slash command output.

### Development

Future implementation will include:

#### App

- A startup script that runs the server (in the same process).
- The startup script will run `bun vite` with an environment variable set to the server URL
- The client will use this environment variable for WebSocket and HTTP requests

This will ease the development on the client.

## Usage Examples

### Start a dev server

```
pty_spawn: command="npm", args=["run", "dev"], title="Dev Server"
→ Returns: pty_a1b2c3d4
```

### Check server output

```
pty_read: id="pty_a1b2c3d4", limit=50
→ Shows last 50 lines of output
```

### Filter for errors

```
pty_read: id="pty_a1b2c3d4", pattern="error|ERROR", ignoreCase=true
→ Shows only lines matching the pattern
```

### Send Ctrl+C to stop

```
pty_write: id="pty_a1b2c3d4", data="\x03"
→ Sends interrupt signal
```

### Kill and cleanup

```
pty_kill: id="pty_a1b2c3d4", cleanup=true
→ Terminates process and frees buffer
```

### Run with exit notification

```
pty_spawn: command="npm", args=["run", "build"], title="Build", notifyOnExit=true
→ Returns: pty_a1b2c3d4
```

The AI agent will receive a notification when the build completes:

```xml
<pty_exited>
ID: pty_a1b2c3d4
Title: Build
Exit Code: 0
Output Lines: 42
Last Line: Build completed successfully.
</pty_exited>

Use pty_read to check the full output.
```

This eliminates the need for polling—perfect for long-running processes like builds, tests, or deployment scripts. If the process fails (non-zero exit code), the notification will suggest using `pty_read` with the `pattern` parameter to search for errors.

## Configuration

### Environment Variables

| Variable               | Default | Description                                        |
| ---------------------- | ------- | -------------------------------------------------- |
| `PTY_MAX_BUFFER_LINES` | `50000` | Maximum lines to keep in output buffer per session |

### Permissions

This plugin respects OpenCode's [permission settings](https://opencode.ai/docs/permissions/) for the `bash` tool. Commands spawned via `pty_spawn` are checked against your `permission.bash` configuration.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "bash": {
      "npm *": "allow",
      "git push": "deny",
      "terraform *": "deny"
    }
  }
}
```

> [!IMPORTANT]
> **Limitations compared to built-in bash tool:**
>
> - **"ask" permissions are treated as "deny"**: Since plugins cannot trigger OpenCode's permission prompt UI, commands matching an "ask" pattern will be denied. A toast notification will inform you when this happens. Configure explicit "allow" or "deny" for commands you want to use with PTY.
> - **"external_directory" with "ask" is treated as "allow"**: When the working directory is outside the project and `permission.external_directory` is set to "ask", this plugin allows it (with a log message). Set to "deny" explicitly if you want to block external directories.

#### Example: Allow specific commands for PTY

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "bash": {
      "npm run dev": "allow",
      "npm run build": "allow",
      "npm test *": "allow",
      "cargo *": "allow",
      "python *": "allow"
    }
  }
}
```

## How It Works

1. **Spawn**: Creates a PTY using [bun-pty](https://github.com/nicksrandall/bun-pty), runs command in background
2. **Buffer**: Output is captured into a rolling line buffer (ring buffer)
3. **Read**: Agent can read buffer anytime with offset/limit pagination
4. **Filter**: Optional regex pattern filters lines before pagination
5. **Write**: Agent can send any input including escape sequences
6. **Lifecycle**: Sessions track status (running/exited/killed), persist until cleanup
7. **Notify**: When `notifyOnExit` is true, sends a message to the session when the process exits
8. **Web UI**: React frontend connects via WebSocket for real-time updates

## Session Lifecycle

```
spawn → running → [exited | killed]
                      ↓
              (stays in list until cleanup=true)
```

Sessions remain in the list after exit so the agent can:

- Read final output
- Check exit code
- Compare logs between runs

Use `pty_kill` with `cleanup=true` to remove completely.

## Local Development

```bash
git clone https://github.com/MBanucu/opencode-pty.git
cd opencode-pty
bun install
bun run typecheck  # Type check
bun run build      # Build the React app for production
bun run dev        # Start React dev server with hot reloading
```

To load a local checkout in OpenCode:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///absolute/path/to/opencode-pty/index.ts"]
}
```

## Building OpenCode Plugins

Here's a practical guide to building an **OpenCode** plugin using **Bun** so it loads correctly from the `.opencode/plugins/` directory (project-local plugins).

OpenCode has excellent built-in support for Bun — it automatically runs `bun install` on startup when it finds a `package.json` in the `.opencode/` folder, and it loads TypeScript/JavaScript files directly from `.opencode/plugins/` without any separate build step in most cases.

### Two main approaches in 2025/2026

**Approach A – Recommended for most plugins (no build step)**  
Put plain `.ts` or `.js` files directly into `.opencode/plugins/`. OpenCode loads & executes them natively via Bun.

**Approach B – When you want a proper build / bundling / multiple files**  
Use Bun to compile/transpile → output JavaScript into `.opencode/plugins/`.

### Approach A – Simple & most common (no build)

1. In your project root create the folders if they don't exist:

   ```
   mkdir -p .opencode/plugins
   ```

2. Create `package.json` **in `.opencode/`** (not inside plugins/) — even if almost empty:

   ```json
   {
     "name": "my-opencode-plugins",
     "private": true,
     "dependencies": {
       "@opencode-ai/plugin": "^1.x" // optional but strongly recommended
     }
   }
   ```

   → OpenCode will run `bun install` automatically the next time you start `opencode`.

3. Create your plugin file — e.g. `.opencode/plugins/my-cool-feature.ts`

   ```ts
   import type { Plugin } from '@opencode-ai/plugin'

   export const plugin: Plugin = {
     name: 'my-cool-feature',

     hooks: {
       // Most popular hook — runs after each agent turn
       'agent:post-turn': async ({ client, message }) => {
         if (message.role === 'assistant') {
           // Example: auto-format code blocks the agent just wrote
           await client.sendMessage({
             role: 'system',
             content: 'Consider running biome format on changed files…',
           })
         }
       },

       // Another common one
       'session:start': async ({ client }) => {
         await client.sendMessage({
           role: 'system',
           content: '🔥 my-cool-feature plugin is active!',
         })
       },
     },
   }
   ```

4. (optional) Add to project `opencode.json` or `opencode.jsonc` to explicitly enable/disable:

   ```json
   {
     "plugins": {
       "my-cool-feature": {
         "enabled": true
       }
     }
   }
   ```

5. Just run `opencode` → the plugin should be loaded automatically.

### Approach B – Using Bun to build (for larger plugins / tsconfig / bundling)

Use this when your plugin has many files, complex types, or you want to use `bun build`.

1. Create a source folder (outside `.opencode/` or inside it)

   Example structure:

   ```
   my-plugin/
   ├── src/
   │   └── index.ts
   ├── .opencode/
   │   ├── plugins/           ← built files will go here
   │   └── package.json
   ├── bunfig.toml            (optional)
   └── tsconfig.json
   ```

2. `src/index.ts` — same content as above

3. `tsconfig.json` (example)

   ```json
   {
     "compilerOptions": {
       "target": "ESNext",
       "module": "ESNext",
       "moduleResolution": "Bundler",
       "outDir": ".opencode/plugins",
       "strict": true,
       "skipLibCheck": true
     },
     "include": ["src"]
   }
   ```

4. Add build script to `.opencode/package.json`

   ```json
   {
     "name": "my-plugins",
     "private": true,
     "scripts": {
       "build": "bun build ./../src/index.ts --outdir ./plugins --target bun"
     },
     "dependencies": {
       "@opencode-ai/plugin": "^1.x"
     }
   }
   ```

5. Build & test

   ```bash
   cd .opencode
   bun run build
   # or just
   bun build ../src/index.ts --outdir ./plugins --target bun
   ```

   → you now have `plugins/index.js` (or whatever name you chose)

6. Start `opencode` — it loads `.js` files from `.opencode/plugins/` the same way as `.ts`

### Quick checklist – what usually goes wrong

- No `package.json` in `.opencode/` → external dependencies won't install
- Plugin file doesn't export `plugin` with correct shape → ignored silently
- Syntax error in plugin → usually logged when starting `opencode`
- Using `import ... from "npm:..."` without `package.json` → fails
- Forgetting to restart `opencode` after changes

### One-liner starter (most common case)

```bash
mkdir -p .opencode/{plugins,}
echo '{"dependencies":{"@opencode-ai/plugin":"^1"}}' > .opencode/package.json
```

Then drop `.ts` files into `.opencode/plugins/` and restart.

Good luck with your plugin — and check https://opencode.ai/docs/plugins for the latest hook & tool API reference.

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a PR.

## Credits

- [OpenCode](https://opencode.ai) - The AI coding assistant this plugin extends
- [bun-pty](https://github.com/nicksrandall/bun-pty) - Cross-platform PTY for Bun
