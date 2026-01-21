import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../components/App'

// Mock WebSocket
let mockWebSocket: any
const createMockWebSocket = () => ({
  send: vi.fn(),
  close: vi.fn(),
  onopen: null as (() => void) | null,
  onmessage: null as ((event: any) => void) | null,
  onerror: null as (() => void) | null,
  onclose: null as (() => void) | null,
  readyState: 1,
})

// Mock fetch for API calls
const mockFetch = vi.fn() as any
global.fetch = mockFetch

// Mock WebSocket constructor
global.WebSocket = vi.fn(() => {
  mockWebSocket = createMockWebSocket()
  return mockWebSocket
}) as any

// Mock location
Object.defineProperty(window, 'location', {
  value: {
    host: 'localhost',
    hostname: 'localhost',
    protocol: 'http:',
  },
  writable: true,
})

describe('App E2E - Historical Output Fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('automatically fetches and displays historical output when sessions are loaded', async () => {
    // Mock successful fetch for historical output
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lines: ['Historical Line 1', 'Historical Line 2', 'Session Complete'],
        totalLines: 3,
        hasMore: false
      })
    })

    render(<App />)

    // Simulate WebSocket connection and session list with exited session
    await act(async () => {
      if (mockWebSocket.onopen) {
        mockWebSocket.onopen()
      }

      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({
          data: JSON.stringify({
            type: 'session_list',
            sessions: [{
              id: 'pty_exited123',
              title: 'Exited Session',
              command: 'echo',
              status: 'exited',
              pid: 12345,
              lineCount: 3,
              createdAt: new Date().toISOString(),
            }]
          })
        })
      }
    })

    // Verify session appears and is auto-selected (appears in both sidebar and header)
    await waitFor(() => {
      expect(screen.getAllByText('Exited Session')).toHaveLength(2) // Sidebar + header
      expect(screen.getByText('exited')).toBeInTheDocument()
    })

    // Verify historical output was fetched
    expect(mockFetch).toHaveBeenCalledWith('/api/sessions/pty_exited123/output')

    // Verify historical output is displayed
    await waitFor(() => {
      expect(screen.getByText('Historical Line 1')).toBeInTheDocument()
      expect(screen.getByText('Historical Line 2')).toBeInTheDocument()
      expect(screen.getByText('Session Complete')).toBeInTheDocument()
    })

    // Verify session is auto-selected (appears in both sidebar and header)
    expect(screen.getAllByText('Exited Session')).toHaveLength(2)
  })

  it('handles historical output fetch errors gracefully', async () => {
    // Mock failed fetch for historical output
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(<App />)

    // Simulate WebSocket connection and session list
    await act(async () => {
      if (mockWebSocket.onopen) {
        mockWebSocket.onopen()
      }

      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({
          data: JSON.stringify({
            type: 'session_list',
            sessions: [{
              id: 'pty_error123',
              title: 'Error Session',
              command: 'echo',
              status: 'exited',
              pid: 12346,
              lineCount: 1,
              createdAt: new Date().toISOString(),
            }]
          })
        })
      }
    })

    // Verify session appears despite fetch error (auto-selected)
    await waitFor(() => {
      expect(screen.getAllByText('Error Session')).toHaveLength(2) // Sidebar + header
    })

    // Verify fetch was attempted
    expect(mockFetch).toHaveBeenCalledWith('/api/sessions/pty_error123/output')

    // Should still show waiting state (no output displayed due to error)
    expect(screen.getByText('Waiting for output...')).toBeInTheDocument()
  })

  it('fetches historical output when manually selecting exited sessions', async () => {
    // Setup: First load with running session, then add exited session
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lines: ['Manual fetch line 1', 'Manual fetch line 2'],
        totalLines: 2,
        hasMore: false
      })
    })

    render(<App />)

    // Initial session list with running session
    await act(async () => {
      if (mockWebSocket.onopen) {
        mockWebSocket.onopen()
      }

      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({
          data: JSON.stringify({
            type: 'session_list',
            sessions: [{
              id: 'pty_running456',
              title: 'Running Session',
              command: 'bash',
              status: 'running',
              pid: 12347,
              lineCount: 0,
              createdAt: new Date().toISOString(),
            }]
          })
        })
      }
    })

    // Running session should be auto-selected, output cleared for live streaming
    await waitFor(() => {
      expect(screen.getAllByText('Running Session')).toHaveLength(2) // Sidebar + header
    })

    // Now add an exited session and simulate user clicking it
    await act(async () => {
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({
          data: JSON.stringify({
            type: 'session_list',
            sessions: [
              {
                id: 'pty_running456',
                title: 'Running Session',
                command: 'bash',
                status: 'running',
                pid: 12347,
                lineCount: 0,
                createdAt: new Date().toISOString(),
              },
              {
                id: 'pty_exited789',
                title: 'Exited Session',
                command: 'echo',
                status: 'exited',
                pid: 12348,
                lineCount: 2,
                createdAt: new Date().toISOString(),
              }
            ]
          })
        })
      }
    })

    // Both sessions should appear (running session is auto-selected, so it appears twice)
    await waitFor(() => {
      expect(screen.getAllByText('Running Session')).toHaveLength(2) // Sidebar + header
      expect(screen.getByText('Exited Session')).toBeInTheDocument()
    })

    // Click on the exited session (find the one in sidebar, not header)
    const exitedSessionItem = screen.getByText('Exited Session').closest('.session-item')
    if (exitedSessionItem) {
      await userEvent.click(exitedSessionItem)
    }

    // Verify historical output was fetched for the clicked session
    expect(mockFetch).toHaveBeenCalledWith('/api/sessions/pty_exited789/output')

    // Verify new historical output is displayed
    await waitFor(() => {
      expect(screen.getByText('Manual fetch line 1')).toBeInTheDocument()
      expect(screen.getByText('Manual fetch line 2')).toBeInTheDocument()
    })
  })

  it('does not fetch historical output for running sessions on selection', async () => {
    render(<App />)

    // Simulate session list with running session
    await act(async () => {
      if (mockWebSocket.onopen) {
        mockWebSocket.onopen()
      }

      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({
          data: JSON.stringify({
            type: 'session_list',
            sessions: [{
              id: 'pty_running999',
              title: 'Running Only Session',
              command: 'bash',
              status: 'running',
              pid: 12349,
              lineCount: 0,
              createdAt: new Date().toISOString(),
            }]
          })
        })
      }
    })

    // Running session should be auto-selected
    await waitFor(() => {
      expect(screen.getAllByText('Running Only Session')).toHaveLength(2) // Sidebar + header
    })

    // No fetch should be called for running sessions
    expect(mockFetch).not.toHaveBeenCalled()

    // Should show waiting state for live output
    expect(screen.getByText('Waiting for output...')).toBeInTheDocument()
  })
})