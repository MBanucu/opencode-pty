import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../components/App'

// Mock WebSocket
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  onopen: null as (() => void) | null,
  onmessage: null as ((event: any) => void) | null,
  onerror: null as (() => void) | null,
  onclose: null as (() => void) | null,
  readyState: 1,
}

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: vi.fn().mockResolvedValue([]),
}) as any

// Mock WebSocket constructor
global.WebSocket = vi.fn(() => mockWebSocket) as any

// Mock location
Object.defineProperty(window, 'location', {
  value: {
    host: 'localhost',
    hostname: 'localhost',
    protocol: 'http:',
  },
  writable: true,
})

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the PTY Sessions title', () => {
    render(<App />)
    expect(screen.getByText('PTY Sessions')).toBeInTheDocument()
  })

  it('shows disconnected status initially', () => {
    render(<App />)
    expect(screen.getByText('○ Disconnected')).toBeInTheDocument()
  })

  it('shows no active sessions message when empty', () => {
    render(<App />)
    expect(screen.getByText('No active sessions')).toBeInTheDocument()
  })

  it('connects to WebSocket on mount', () => {
    render(<App />)
    expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost')
  })

  it('shows connected status when WebSocket opens', async () => {
    render(<App />)

    // Simulate WebSocket open event
    await act(async () => {
      if (mockWebSocket.onopen) {
        mockWebSocket.onopen()
      }
    })

    await waitFor(() => {
      expect(screen.getByText('● Connected')).toBeInTheDocument()
    })
  })

  it('displays sessions when received from WebSocket', async () => {
    render(<App />)

    // Simulate receiving session list - this should auto-select the session
    await act(async () => {
      if (mockWebSocket.onmessage) {
        const mockSession = {
          id: 'pty_test123',
          title: 'Test Session',
          command: 'echo',
          status: 'running',
          pid: 12345,
          lineCount: 5,
          createdAt: new Date().toISOString(),
        }

        mockWebSocket.onmessage({
          data: JSON.stringify({
            type: 'session_list',
            sessions: [mockSession],
          }),
        })
      }
    })

    await waitFor(() => {
      expect(screen.getAllByText('Test Session')).toHaveLength(2) // One in sidebar, one in header (auto-selected)
      expect(screen.getByText('echo')).toBeInTheDocument()
      expect(screen.getByText('running')).toBeInTheDocument()
    })
  })

  it('shows empty state when no session is selected', async () => {
    render(<App />)
    expect(screen.getByText('Select a session from the sidebar to view its output')).toBeInTheDocument()
  })

  it('displays session output when session is selected', async () => {
    render(<App />)

    // Add a session - this should auto-select it due to our new logic
    await act(async () => {
      if (mockWebSocket.onmessage) {
        const mockSession = {
          id: 'pty_test123',
          title: 'Test Session',
          command: 'echo',
          status: 'running',
          pid: 12345,
          lineCount: 5,
          createdAt: new Date().toISOString(),
        }

        mockWebSocket.onmessage({
          data: JSON.stringify({
            type: 'session_list',
            sessions: [mockSession],
          }),
        })
      }
    })

    // Wait for session to appear and be auto-selected
    await waitFor(() => {
      expect(screen.getAllByText('Test Session')).toHaveLength(2) // One in sidebar, one in header
      expect(screen.getByPlaceholderText('Type input...')).toBeInTheDocument()
      expect(screen.getByText('Send')).toBeInTheDocument()
      expect(screen.getByText('Kill Session')).toBeInTheDocument()
    })
  })
})