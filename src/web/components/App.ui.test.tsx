import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../components/App'

// Mock WebSocket
const createMockWebSocket = () => ({
  send: vi.fn(),
  close: vi.fn(),
  onopen: null as (() => void) | null,
  onmessage: null as ((event: any) => void) | null,
  onclose: null as (() => void) | null,
  onerror: null as (() => void) | null,
  readyState: 1,
})

// Mock fetch
const mockFetch = vi.fn() as any
global.fetch = mockFetch

// Mock WebSocket constructor
const mockWebSocketConstructor = vi.fn(() => createMockWebSocket())
global.WebSocket = mockWebSocketConstructor as any

// Mock location
Object.defineProperty(window, 'location', {
  value: {
    host: 'localhost',
    hostname: 'localhost',
    protocol: 'http:',
    port: '5173', // Simulate Vite dev server
  },
  writable: true,
})

describe('App Component - UI Rendering Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders PTY output correctly when received via WebSocket', async () => {
    // Mock successful fetch for session output
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ lines: [], totalLines: 0, hasMore: false })
    })

    render(<App />)

    // Simulate WebSocket connection and session setup
    await act(async () => {
      const wsInstance = mockWebSocketConstructor.mock.results[0]?.value
      if (wsInstance?.onopen) {
        wsInstance.onopen()
      }

      if (wsInstance?.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify({
            type: 'session_list',
            sessions: [{
              id: 'pty_test123',
              title: 'Test Session',
              command: 'bash',
              status: 'running',
              pid: 12345,
              lineCount: 0,
              createdAt: new Date().toISOString(),
            }]
          })
        })
      }
    })

    // Verify session appears and is auto-selected
    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument()
    })

    // Simulate receiving PTY output via WebSocket
    console.log('🧪 Sending mock PTY output to component...')
    await act(async () => {
      const wsInstance = mockWebSocketConstructor.mock.results[0]?.value
      if (wsInstance?.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify({
            type: 'data',
            sessionId: 'pty_test123',
            data: 'Welcome to the terminal\r\n$ '
          })
        })
      }
    })

    // Verify the output appears in the UI
    await waitFor(() => {
      expect(screen.getByText('Welcome to the terminal')).toBeInTheDocument()
      expect(screen.getByText('$')).toBeInTheDocument()
    })

    console.log('✅ PTY output successfully rendered in UI')
  })

  it('displays multiple lines of PTY output correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ lines: [], totalLines: 0, hasMore: false })
    })

    render(<App />)

    // Setup session
    await act(async () => {
      const wsInstance = mockWebSocketConstructor.mock.results[0]?.value
      if (wsInstance?.onopen) wsInstance.onopen()
      if (wsInstance?.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify({
            type: 'session_list',
            sessions: [{
              id: 'pty_multi123',
              title: 'Multi-line Test',
              command: 'bash',
              status: 'running',
              pid: 12346,
              lineCount: 0,
              createdAt: new Date().toISOString(),
            }]
          })
        })
      }
    })

    await waitFor(() => {
      expect(screen.getByText('Multi-line Test')).toBeInTheDocument()
    })

    // Send multiple lines of output
    const testLines = [
      'Line 1: Command executed\r\n',
      'Line 2: Processing data\r\n',
      'Line 3: Complete\r\n$ '
    ]

    for (const line of testLines) {
      await act(async () => {
        const wsInstance = mockWebSocketConstructor.mock.results[0]?.value
        if (wsInstance?.onmessage) {
          wsInstance.onmessage({
            data: JSON.stringify({
              type: 'data',
              sessionId: 'pty_multi123',
              data: line
            })
          })
        }
      })
    }

    // Verify all lines appear
    await waitFor(() => {
      expect(screen.getByText('Line 1: Command executed')).toBeInTheDocument()
      expect(screen.getByText('Line 2: Processing data')).toBeInTheDocument()
      expect(screen.getByText('Line 3: Complete')).toBeInTheDocument()
      expect(screen.getByText('$')).toBeInTheDocument()
    })

    console.log('✅ Multiple PTY output lines rendered correctly')
  })

  it('maintains output when switching between sessions', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lines: ['Session A: Initial output'], totalLines: 1, hasMore: false })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lines: ['Session B: Initial output'], totalLines: 1, hasMore: false })
      })

    render(<App />)

    // Setup two sessions
    await act(async () => {
      const wsInstance = mockWebSocketConstructor.mock.results[0]?.value
      if (wsInstance?.onopen) wsInstance.onopen()
      if (wsInstance?.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify({
            type: 'session_list',
            sessions: [
              {
                id: 'pty_session_a',
                title: 'Session A',
                command: 'bash',
                status: 'running',
                pid: 12347,
                lineCount: 1,
                createdAt: new Date().toISOString(),
              },
              {
                id: 'pty_session_b',
                title: 'Session B',
                command: 'bash',
                status: 'running',
                pid: 12348,
                lineCount: 1,
                createdAt: new Date().toISOString(),
              }
            ]
          })
        })
      }
    })

    // Session A should be auto-selected and show its output
    await waitFor(() => {
      expect(screen.getAllByText('Session A')).toHaveLength(2) // Sidebar + header
      expect(screen.getByText('Session A: Initial output')).toBeInTheDocument()
    })

    // Click on Session B
    const sessionBItems = screen.getAllByText('Session B')
    const sessionBInSidebar = sessionBItems.find(element =>
      element.closest('.session-item')
    )

    if (sessionBInSidebar) {
      await userEvent.click(sessionBInSidebar)
    }

    // Should now show Session B output
    await waitFor(() => {
      expect(screen.getAllByText('Session B')).toHaveLength(2) // Sidebar + header
      expect(screen.getByText('Session B: Initial output')).toBeInTheDocument()
    })

    console.log('✅ Session switching maintains correct output display')
  })

  it('shows empty state when no output and no session selected', () => {
    render(<App />)

    // Should show empty state message
    expect(screen.getByText('Select a session from the sidebar to view its output')).toBeInTheDocument()
    expect(screen.getByText('No active sessions')).toBeInTheDocument()

    console.log('✅ Empty state displays correctly')
  })

  it('displays connection status correctly', async () => {
    render(<App />)

    // Initially should show disconnected
    expect(screen.getByText('○ Disconnected')).toBeInTheDocument()

    // Simulate connection
    await act(async () => {
      const wsInstance = mockWebSocketConstructor.mock.results[0]?.value
      if (wsInstance?.onopen) {
        wsInstance.onopen()
      }
    })

    // Should show connected
    await waitFor(() => {
      expect(screen.getByText('● Connected')).toBeInTheDocument()
    })

    console.log('✅ Connection status updates correctly')
  })
})