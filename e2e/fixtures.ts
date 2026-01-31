import { test as base, type WorkerInfo } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'

async function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) })
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`)
}

type TestFixtures = {}
type WorkerFixtures = {
  server: { baseURL: string; port: number }
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  server: [
    async ({}, use, workerInfo: WorkerInfo) => {
      const workerIndex = workerInfo.workerIndex
      const portFilePath = `/tmp/test-server-port-${workerIndex}.txt`

      const proc: ChildProcess = spawn('bun', ['run', 'e2e/test-web-server.ts'], {
        env: {
          ...process.env,
          TEST_WORKER_INDEX: workerIndex.toString(),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      proc.stdout?.on('data', (_data) => {})

      proc.stderr?.on('data', (data) => {
        console.error(`[W${workerInfo.workerIndex} ERR] ${data}`)
      })

      proc.on('exit', (_code, _signal) => {})

      proc.stderr?.on('data', (data) => {
        console.error(`[W${workerIndex} ERR] ${data}`)
      })

      proc.on('exit', (_code, _signal) => {})

      try {
        // Wait for server to write port file
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            try {
              Bun.file(portFilePath)
                .exists()
                .then((exists) => {
                  if (exists) {
                    clearInterval(checkInterval)
                    resolve()
                  }
                })
            } catch {}
          }, 100)
        })

        // Read the actual URL from port file
        const serverURLText = await Bun.file(portFilePath).text()
        if (!serverURLText) {
          throw new Error(`Port file is empty: ${portFilePath}`)
        }
        const serverURL = serverURLText.trim()

        // Parse URL to extract port number
        const urlMatch = serverURL.match(/http:\/\/localhost:(\d+)/)
        if (!urlMatch || !urlMatch[1]) {
          throw new Error(`Invalid port file format: ${serverURL}`)
        }
        const port = parseInt(urlMatch[1])
        const baseURL = `http://localhost:${port}`

        await waitForServer(baseURL, 15000)
        await use({ baseURL, port })
      } catch (error) {
        console.error(`[Worker ${workerIndex}] Failed to start server: ${error}`)
        throw error
      } finally {
        // Ensure process is killed
        if (!proc.killed) {
          proc.kill('SIGTERM')
          // Wait a bit, then force kill if still running
          setTimeout(() => {
            if (!proc.killed) {
              proc.kill('SIGKILL')
            }
          }, 2000)
        }
        await new Promise((resolve) => {
          if (proc.killed) {
            resolve(void 0)
          } else {
            proc.on('exit', resolve)
          }
        })
      }
    },
    { scope: 'worker', auto: true },
  ],
})

export { expect } from '@playwright/test'
