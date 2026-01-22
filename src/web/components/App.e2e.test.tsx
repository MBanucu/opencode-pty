import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../components/App'
import { spawn } from 'child_process'
import { readFileSync } from 'fs'

let serverProcess: any
let port: number

describe('App E2E - Historical Output Fetching', () => {
  beforeAll(async () => {
    // Start the test server with reduced logging
    serverProcess = spawn('bun', ['run', 'test-web-server.ts'], {
      stdio: 'inherit',
      env: { ...process.env, LOG_LEVEL: 'error' }
    })

    // Wait for server to start
    let retries = 20
    while (retries > 0) {
      try {
        const response = await fetch('http://localhost:8867/api/sessions')
        if (response.ok) break
      } catch {}
      await new Promise(r => setTimeout(r, 500))
      retries--
    }
    if (retries === 0) throw new Error('Server failed to start')

    // Read the actual port
    const portData = readFileSync('/tmp/test-server-port.txt', 'utf8')
    port = parseInt(portData.trim())

    // Set location
    Object.defineProperty(window, 'location', {
      value: {
        host: `localhost:${port}`,
        hostname: 'localhost',
        protocol: 'http:',
        port: port.toString(),
      },
      writable: true,
    })
  })

  afterAll(() => {
    if (serverProcess) serverProcess.kill()
  })

  it('automatically fetches and displays historical output when sessions are loaded', async () => {
    await act(async () => {
      render(<App />)
    })

    // Create an exited session with output
    let session: any
    await act(async () => {
      const response = await fetch(`http://localhost:${port}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'bash',
          args: ['-c', 'echo "Historical Line 1"; echo "Historical Line 2"; echo "Session Complete"'],
          description: 'Exited Session'
        }),
      })
      session = await response.json()
    })

    // Wait for session to appear and be auto-selected
    await waitFor(() => {
      expect(screen.getAllByText('Exited Session')).toHaveLength(2) // Sidebar + header
      expect(screen.getByText('exited')).toBeInTheDocument()
    })

    // Verify historical output is displayed
    await waitFor(() => {
      expect(screen.getByText('Historical Line 1')).toBeInTheDocument()
      expect(screen.getByText('Historical Line 2')).toBeInTheDocument()
      expect(screen.getByText('Session Complete')).toBeInTheDocument()
    })
  })

  it('handles historical output fetch errors gracefully', async () => {
    await act(async () => {
      render(<App />)
    })

    // Create an exited session
    let session: any
    await act(async () => {
      const response = await fetch(`http://localhost:${port}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'bash',
          args: ['-c', 'echo "test"'],
          description: 'Error Session'
        }),
      })
      session = await response.json()
    })

    // Mock fetch to reject for output
    const originalFetch = global.fetch
    ;(global.fetch as any) = vi.fn(async (url, options) => {
      if (typeof url === 'string' && url === `http://localhost:${port}/api/sessions/${session.id}/output`) {
        throw new Error('Network error')
      }
      return originalFetch(url, options)
    })

    try {
      // Wait for session to appear
      await waitFor(() => {
        expect(screen.getAllByText('Error Session')).toHaveLength(2)
      })

      // Should show waiting state
      expect(screen.getByText('Waiting for output...')).toBeInTheDocument()
    } finally {
      global.fetch = originalFetch
    }
  })

  it('fetches historical output when manually selecting exited sessions', async () => {
    await act(async () => {
      render(<App />)
    })

    // Create running session first
    let runningSession: any
    await act(async () => {
      const runningResponse = await fetch(`http://localhost:${port}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'bash',
          args: ['-c', 'for i in {1..10}; do echo "running $i"; sleep 1; done'],
          description: 'Running Session'
        }),
      })
      runningSession = await runningResponse.json()
    })

    // Wait for running session to be selected
    await waitFor(() => {
      expect(screen.getAllByText('Running Session')).toHaveLength(2)
    })

    // Create exited session
    let exitedSession: any
    await act(async () => {
      const exitedResponse = await fetch(`http://localhost:${port}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'bash',
          args: ['-c', 'echo "Manual fetch line 1"; echo "Manual fetch line 2"'],
          description: 'Exited Session'
        }),
      })
      exitedSession = await exitedResponse.json()
    })

    // Wait for exited session to appear
    await waitFor(() => {
      expect(screen.getAllByText('Running Session')).toHaveLength(2)
      expect(screen.getByText('Exited Session')).toBeInTheDocument()
    })

    // Click on exited session
    const exitedItem = screen.getByText('Exited Session').closest('.session-item')
    if (exitedItem) {
      await act(async () => {
        await userEvent.click(exitedItem)
      })
    }

    // Verify output
    await waitFor(() => {
      expect(screen.getByText('Manual fetch line 1')).toBeInTheDocument()
      expect(screen.getByText('Manual fetch line 2')).toBeInTheDocument()
    })
  })

  it('does not fetch historical output for running sessions on selection', async () => {
    await act(async () => {
      render(<App />)
    })

    // Create running session
    let session: any
    await act(async () => {
      const response = await fetch(`http://localhost:${port}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'bash',
          args: ['-c', 'echo "running"; sleep 10'],
          description: 'Running Only Session'
        }),
      })
      session = await response.json()
    })

    // Wait for session to be selected
    await waitFor(() => {
      expect(screen.getAllByText('Running Only Session')).toHaveLength(2)
    })

    // Should show waiting state
    expect(screen.getByText('Waiting for output...')).toBeInTheDocument()
  })
})