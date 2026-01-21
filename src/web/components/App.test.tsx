import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../components/App'

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

  it('shows empty state when no session is selected', () => {
    render(<App />)
    expect(screen.getByText('Select a session from the sidebar to view its output')).toBeInTheDocument()
  })
})