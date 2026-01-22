import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { Session } from '../types.ts'
import pinoLogger from '../logger.ts'

const logger = pinoLogger.child({ module: 'App' })

export function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [output, setOutput] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [connected, setConnected] = useState(false)
  const [wsMessageCount, setWsMessageCount] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const activeSessionRef = useRef<Session | null>(null)
  const wsMessageCountRef = useRef(0)

  // Keep ref in sync with activeSession state
  useEffect(() => {
    activeSessionRef.current = activeSession
  }, [activeSession])

  // Connect to WebSocket on mount
  useEffect(() => {
    const ws = new WebSocket(`ws://${location.host}`)
    ws.onopen = () => {
      logger.info('WebSocket connected')
      setConnected(true)
      // Request initial session list
      ws.send(JSON.stringify({ type: 'session_list' }))
    }
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        logger.debug({ type: data.type, sessionId: data.sessionId }, 'WebSocket message received')
        if (data.type === 'session_list') {
          logger.info(
            {
              sessionCount: data.sessions?.length,
              activeSessionId: activeSession?.id,
            },
            'Processing session_list message'
          )
          setSessions(data.sessions || [])
          // Auto-select first running session if none selected (skip in tests that need empty state)
          const shouldSkipAutoselect = localStorage.getItem('skip-autoselect') === 'true'
          if (data.sessions.length > 0 && !activeSession && !shouldSkipAutoselect) {
            logger.info('Condition met for auto-selection')
            const runningSession = data.sessions.find((s: Session) => s.status === 'running')
            const sessionToSelect = runningSession || data.sessions[0]
            logger.info({ sessionId: sessionToSelect.id }, 'Auto-selecting session')
            setActiveSession(sessionToSelect)
            // Subscribe to the auto-selected session for live updates
            const readyState = wsRef.current?.readyState
            logger.info(
              {
                sessionId: sessionToSelect.id,
                readyState,
                OPEN: WebSocket.OPEN,
                CONNECTING: WebSocket.CONNECTING,
              },
              'Checking WebSocket state for subscription'
            )

            if (readyState === WebSocket.OPEN && wsRef.current) {
              logger.info({ sessionId: sessionToSelect.id }, 'Subscribing to auto-selected session')
              wsRef.current.send(
                JSON.stringify({ type: 'subscribe', sessionId: sessionToSelect.id })
              )
              logger.info({ sessionId: sessionToSelect.id }, 'Subscription message sent')
            } else {
              logger.warn(
                { sessionId: sessionToSelect.id, readyState },
                'WebSocket not ready for subscription, will retry'
              )
              setTimeout(() => {
                const retryReadyState = wsRef.current?.readyState
                logger.info(
                  { sessionId: sessionToSelect.id, retryReadyState },
                  'Retry check for WebSocket subscription'
                )
                if (retryReadyState === WebSocket.OPEN && wsRef.current) {
                  logger.info(
                    { sessionId: sessionToSelect.id },
                    'Subscribing to auto-selected session (retry)'
                  )
                  wsRef.current.send(
                    JSON.stringify({ type: 'subscribe', sessionId: sessionToSelect.id })
                  )
                  logger.info(
                    { sessionId: sessionToSelect.id },
                    'Subscription message sent (retry)'
                  )
                } else {
                  logger.error(
                    { sessionId: sessionToSelect.id, retryReadyState },
                    'WebSocket still not ready after retry'
                  )
                }
              }, 500) // Increased delay
            }
            // Load historical output for the auto-selected session
            fetch(
              `${location.protocol}//${location.host}/api/sessions/${sessionToSelect.id}/output`
            )
              .then((response) => (response.ok ? response.json() : []))
              .then((outputData) => setOutput(outputData.lines || []))
              .catch(() => setOutput([]))
          }
        } else if (data.type === 'data') {
          const isForActiveSession = activeSessionRef.current?.id === data.sessionId
          logger.debug(
            {
              sessionId: data.sessionId,
              activeSessionId: activeSessionRef.current?.id,
              isForActiveSession,
              dataLength: data.data?.length,
              wsMessageCountBefore: wsMessageCountRef.current,
            },
            'WebSocket DATA message received'
          )

          if (isForActiveSession) {
            logger.debug('Processing data for active session')
            setOutput((prev) => [...prev, ...data.data])
            wsMessageCountRef.current++
            setWsMessageCount(wsMessageCountRef.current)
            logger.debug(
              { wsMessageCountAfter: wsMessageCountRef.current },
              'WS message counter incremented'
            )
          } else {
            logger.debug('Ignoring data message for inactive session')
          }
        }
      } catch (error) {
        logger.error({ error }, 'Failed to parse WebSocket message')
      }
    }
    ws.onclose = () => {
      logger.info('WebSocket disconnected')
      setConnected(false)
    }
    ws.onerror = (error) => {
      logger.error({ error }, 'WebSocket error')
    }
    wsRef.current = ws
    return () => ws.close()
  }, [activeSession])

  // Initial session refresh as fallback - called during WebSocket setup

  const handleSessionClick = useCallback(async (session: Session) => {
    try {
      // Validate session object first
      if (!session?.id) {
        logger.error({ session }, 'Invalid session object passed to handleSessionClick')
        return
      }
      setActiveSession(session)
      setInputValue('')
      // Reset WebSocket message counter when switching sessions
      setWsMessageCount(0)
      wsMessageCountRef.current = 0

      // Subscribe to this session for live updates
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'subscribe', sessionId: session.id }))
      } else {
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'subscribe', sessionId: session.id }))
          }
        }, 100)
      }

      try {
        const baseUrl = `${location.protocol}//${location.host}`
        const response = await fetch(`${baseUrl}/api/sessions/${session.id}/output`)

        if (response.ok) {
          const outputData = await response.json()
          setOutput(outputData.lines || [])
        } else {
          const errorText = await response.text().catch(() => 'Unable to read error response')
          logger.error({ status: response.status, error: errorText }, 'Fetch failed')
          setOutput([])
        }
      } catch (fetchError) {
        logger.error({ error: fetchError }, 'Network error fetching output')
        setOutput([])
      }
    } catch (error) {
      logger.error({ error }, 'Unexpected error in handleSessionClick')
      // Ensure UI remains stable
      setOutput([])
    }
  }, [])

  const handleSendInput = useCallback(async () => {
    if (!inputValue.trim() || !activeSession) {
      return
    }

    try {
      const baseUrl = `${location.protocol}//${location.host}`
      const response = await fetch(`${baseUrl}/api/sessions/${activeSession.id}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: inputValue + '\n' }),
      })

      if (response.ok) {
        setInputValue('')
      } else {
        const errorText = await response.text().catch(() => 'Unable to read error response')
        logger.error(
          {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          },
          'Failed to send input'
        )
      }
    } catch (error) {
      logger.error({ error }, 'Network error sending input')
    }
  }, [inputValue, activeSession])

  const handleKillSession = useCallback(async () => {
    if (!activeSession) {
      return
    }

    if (!confirm(`Are you sure you want to kill session "${activeSession.title}"?`)) {
      return
    }

    try {
      const baseUrl = `${location.protocol}//${location.host}`
      const response = await fetch(`${baseUrl}/api/sessions/${activeSession.id}/kill`, {
        method: 'POST',
      })

      if (response.ok) {
        setActiveSession(null)
        setOutput([])
      } else {
        const errorText = await response.text().catch(() => 'Unable to read error response')
        logger.error(
          {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          },
          'Failed to kill session'
        )
      }
    } catch (error) {
      logger.error({ error }, 'Network error killing session')
    }
  }, [activeSession])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSendInput()
      }
    },
    [handleSendInput]
  )

  return (
    <div className="container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>PTY Sessions</h1>
        </div>
        <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '● Connected' : '○ Disconnected'}
        </div>
        <div className="session-list">
          {sessions.length === 0 ? (
            <div style={{ padding: '16px', color: '#8b949e', textAlign: 'center' }}>
              No active sessions
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`session-item ${activeSession?.id === session.id ? 'active' : ''}`}
                onClick={() => handleSessionClick(session)}
              >
                <div className="session-title">{session.title}</div>
                <div className="session-info">
                  <span>{session.command}</span>
                  <span className={`status-badge status-${session.status}`}>{session.status}</span>
                </div>
                <div className="session-info" style={{ marginTop: '4px' }}>
                  <span>PID: {session.pid}</span>
                  <span>{session.lineCount} lines</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="main">
        {activeSession ? (
          <>
            <div className="output-header">
              <div className="output-title">{activeSession.title}</div>
              <button className="kill-btn" onClick={handleKillSession}>
                Kill Session
              </button>
            </div>
            <div className="output-container" ref={outputRef}>
              {output.length === 0 ? (
                <div className="empty-state">Waiting for output...</div>
              ) : (
                output.map((line, index) => (
                  <div key={index} className="output-line" style={{ whiteSpace: 'pre' }}>
                    {line}
                  </div>
                ))
              )}
            </div>
            <div className="input-container">
              <input
                type="text"
                className="input-field"
                placeholder={
                  activeSession.status === 'running' ? 'Type input...' : 'Session not running'
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={activeSession.status !== 'running'}
              />
              <button
                className="send-btn"
                onClick={handleSendInput}
                disabled={activeSession.status !== 'running' || !inputValue.trim()}
              >
                Send
              </button>
            </div>

            {/* Debug info for testing - hidden in production */}
            <div
              style={{
                display: 'block', // Always visible for debugging
                fontSize: '10px',
                color: '#666',
                marginTop: '10px',
                borderTop: '1px solid #ccc',
                paddingTop: '5px',
              }}
              data-testid="debug-info"
            >
              Debug: {output.length} lines, active: {activeSession?.id || 'none'}, WS messages:{' '}
              {wsMessageCount}
            </div>
          </>
        ) : (
          <div className="empty-state">Select a session from the sidebar to view its output</div>
        )}
      </div>
    </div>
  )
}
