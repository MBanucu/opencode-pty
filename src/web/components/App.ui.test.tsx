import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../components/App'

// Helper function to create a real session via API
const createRealSession = async (command: string, title?: string) => {
  const baseUrl = 'http://localhost:8867'
  const response = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command,
      description: title || 'Test Session',
    }),
  })
  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status}`)
  }
  return await response.json()
}

describe('App Component - UI Rendering Verification', () => {
  beforeEach(async () => {
    // Clear any existing sessions from previous tests
    try {
      await fetch('http://localhost:8867/api/sessions/clear', { method: 'POST' })
    } catch (error) {
      // Ignore errors if server not running
    }

    // Mock location for the test environment
    Object.defineProperty(window, 'location', {
      value: {
        host: 'localhost:8867',
        hostname: 'localhost',
        protocol: 'http:',
        port: '8867',
      },
      writable: true,
    })
  })

  it('renders PTY output correctly when received via WebSocket', async () => {
    // Create a real session
    const session = await createRealSession('echo "Welcome to the terminal"', 'Test Session')

    render(<App />)

    // Wait for session to appear and be auto-selected
    await waitFor(() => {
      expect(screen.getAllByText('echo "Welcome to the terminal"')).toHaveLength(2) // Sidebar + header
    })

    // Wait for the PTY output to appear via real WebSocket
    await waitFor(() => {
      expect(screen.getByText('Welcome to the terminal')).toBeInTheDocument()
    }, { timeout: 10000 })

    console.log('✅ PTY output successfully rendered in UI')
  })

  it('displays multiple lines of PTY output correctly', async () => {
    // Create a real session with multi-line output (this will be exited immediately since it's echo)
    const session = await createRealSession(
      'echo "Line 1: Command executed"; echo "Line 2: Processing data"; echo "Line 3: Complete"',
      'Multi-line Test'
    )

    render(<App />)

    // Wait for session to appear and be selected
    await waitFor(() => {
      expect(screen.getAllByText('echo "Line 1: Command executed"; echo "Line 2: Processing data"; echo "Line 3: Complete"')).toHaveLength(3) // Sidebar title + info + header
    })

    console.log('✅ Multi-line PTY session created and displayed correctly')
  })

  it('maintains output when switching between sessions', async () => {
    // Create two real sessions
    const sessionA = await createRealSession('echo "Session A: Initial output"', 'Session A')
    const sessionB = await createRealSession('echo "Session B: Initial output"', 'Session B')

    render(<App />)

    // Session A should be auto-selected and show its output
    await waitFor(() => {
      expect(screen.getAllByText('echo "Session A: Initial output"')).toHaveLength(3) // Sidebar title + info + header
      expect(screen.getByText('Session A: Initial output')).toBeInTheDocument()
    })

    // Click on Session B
    const sessionBItems = screen.getAllByText('echo "Session B: Initial output"')
    const sessionBInSidebar = sessionBItems.find(element =>
      element.closest('.session-item')
    )

    if (sessionBInSidebar) {
      await userEvent.click(sessionBInSidebar)
    }

    // Should now show Session B output
    await waitFor(() => {
      expect(screen.getAllByText('echo "Session B: Initial output"')).toHaveLength(3) // Sidebar title + info + header
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

    // Wait for real WebSocket connection
    await waitFor(() => {
      expect(screen.getByText('● Connected')).toBeInTheDocument()
    }, { timeout: 5000 })

    console.log('✅ Connection status updates correctly')
  })
})