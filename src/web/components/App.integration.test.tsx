import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { App } from '../components/App'

// Mock WebSocket to prevent real connections
global.WebSocket = class MockWebSocket {
  constructor() {
    // Mock constructor
  }
  addEventListener() {}
  send() {}
  close() {}
} as any

// Mock fetch to prevent network calls
global.fetch = (() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve([])
})) as any

// Integration test to ensure the full component renders without crashing
it('renders complete UI without errors', async () => {
  await act(async () => {
    render(<App />)
  })

  // Verify key UI elements are present
  expect(screen.getByText('PTY Sessions')).toBeInTheDocument()
  expect(screen.getByText('○ Disconnected')).toBeInTheDocument()
  expect(screen.getByText('No active sessions')).toBeInTheDocument()
  expect(screen.getByText('Select a session from the sidebar to view its output')).toBeInTheDocument()
})

it.skip('has proper accessibility attributes', () => {
  render(<App />)

  // Check that heading has proper role
  const heading = screen.getByRole('heading', { name: 'PTY Sessions' })
  expect(heading).toBeTruthy()

  // Check input field is not shown initially (no sessions)
  const input = screen.queryByPlaceholderText(/Type input/)
  expect(input).toBeNull() // Not shown until session selected

  // Check main content areas exist
  expect(screen.getByText('○ Disconnected')).toBeTruthy()
  expect(screen.getByText('No active sessions')).toBeTruthy()
})

it.skip('maintains component structure integrity', () => {
  render(<App />)

  // Verify the main layout structure
  const container = screen.getByText('PTY Sessions').closest('.container')
  expect(container).toBeTruthy()

  const sidebar = container?.querySelector('.sidebar')
  const main = container?.querySelector('.main')

  expect(sidebar).toBeTruthy()
  expect(main).toBeTruthy()
})