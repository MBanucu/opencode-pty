import { initManager, manager } from './src/plugin/pty/manager.ts'
import { initLogger } from './src/plugin/logger.ts'
import { startWebServer } from './src/web/server.ts'

const logLevels = { debug: 0, info: 1, warn: 2, error: 3 }
const currentLevel = logLevels[process.env.LOG_LEVEL as keyof typeof logLevels] ?? logLevels.info

// Set NODE_ENV if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test'
}

const fakeClient = {
  app: {
    log: async (opts: any) => {
      const { level = 'info', message, extra } = opts.body || opts
      const levelNum = logLevels[level as keyof typeof logLevels] ?? logLevels.info
      if (levelNum >= currentLevel) {
        const extraStr = extra ? ` ${JSON.stringify(extra)}` : ''
        console.log(`[${level}] ${message}${extraStr}`)
      }
    },
  },
} as any
initLogger(fakeClient)
initManager(fakeClient)

// Find an available port
function findAvailablePort(startPort: number = 8867): number {
  for (let port = startPort; port < startPort + 100; port++) {
    try {
      // Try to kill any process on this port
      Bun.spawnSync(['sh', '-c', `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`])
      // Try to create a server to check if port is free
      const testServer = Bun.serve({
        port,
        fetch() {
          return new Response('test')
        },
      })
      testServer.stop()
      return port
    } catch (error) {
      // Port in use, try next
      continue
    }
  }
  throw new Error('No available port found')
}

// Allow port to be specified via command line argument for parallel test workers
const portArg = process.argv.find((arg) => arg.startsWith('--port='))
const specifiedPort = portArg ? parseInt(portArg.split('=')[1] || '0', 10) : null
let port = specifiedPort && specifiedPort > 0 ? specifiedPort : findAvailablePort()

// For parallel workers, ensure unique ports
if (process.env.TEST_WORKER_INDEX) {
  const workerIndex = parseInt(process.env.TEST_WORKER_INDEX, 10)
  port = 8867 + workerIndex
}

// Clear any existing sessions from previous runs
manager.clearAllSessions()

const url = startWebServer({ port })

// Only log in non-test environments or when explicitly requested
if (process.env.NODE_ENV !== 'test' || process.env.VERBOSE === 'true') {
  console.log(`Server started at ${url}`)
}

// Write port to file for tests to read
if (process.env.NODE_ENV === 'test') {
  await Bun.write('/tmp/test-server-port.txt', port.toString())
}

// Health check for test mode
if (process.env.NODE_ENV === 'test') {
  let retries = 20 // 10 seconds
  while (retries > 0) {
    try {
      const response = await fetch(`http://localhost:${port}/api/sessions`)
      if (response.ok) {
        break
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
    retries--
  }
  if (retries === 0) {
    console.error('Server failed to start properly after 10 seconds')
    process.exit(1)
  }
}

// Create test sessions for manual testing and e2e tests
if (process.env.CI !== 'true' && process.env.NODE_ENV !== 'test') {
  manager.spawn({
    command: 'bash',
    args: [
      '-c',
      "echo 'Welcome to live streaming test'; echo 'Type commands and see real-time output'; for i in {1..100}; do echo \"$(date): Live update $i...\"; sleep 1; done",
    ],
    description: 'Live streaming test session',
    parentSessionId: 'live-test',
  })
}

// Keep the server running indefinitely
setInterval(() => {
  // Keep-alive check - server will continue running
}, 1000)
