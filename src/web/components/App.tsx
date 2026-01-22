import { useState, useEffect, useRef, useCallback } from 'react'
import type { Session } from '../types.ts'
import pinoLogger from '../logger.ts'
import { TerminalRenderer } from './TerminalRenderer.tsx'

const logger = pinoLogger.child({ module: 'App' })

export function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [output, setOutput] = useState<string[]>([])

  const [connected, setConnected] = useState(false)
  const [wsMessageCount, setWsMessageCount] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)

  const activeSessionRef = useRef<Session | null>(null)
  const wsMessageCountRef = useRef(0)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Keep ref in sync with activeSession state
  useEffect(() => {
    activeSessionRef.current = activeSession
  }, [activeSession])

  // Connect to WebSocket on mount
  useEffect(() => {
    logger.debug({ activeSessionId: activeSession?.id }, 'WebSocket useEffect: starting execution')
    const ws = new WebSocket(`ws://${location.host}`)
    logger.debug('WebSocket useEffect: created new WebSocket instance')
    ws.onopen = () => {
      logger.debug('WebSocket onopen: connection established, readyState is OPEN')
      logger.info('WebSocket connected')
      setConnected(true)
      // Request initial session list
      ws.send(JSON.stringify({ type: 'session_list' }))
      // Resubscribe to active session if exists
      if (activeSessionRef.current) {
        logger.debug(
          { sessionId: activeSessionRef.current.id },
          'WebSocket onopen: resubscribing to active session'
        )
        ws.send(JSON.stringify({ type: 'subscribe', sessionId: activeSessionRef.current.id }))
      }
      // Send ping every 30 seconds to keep connection alive
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30000)
    }
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        logger.info({ type: data.type, sessionId: data.sessionId }, 'WebSocket message received')
        if (data.type === 'session_list') {
          logger.debug(
            {
              sessionCount: data.sessions?.length,
              activeSessionId: activeSession?.id,
            },
            'WebSocket onmessage: received session_list'
          )
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
          logger.debug(
            {
              sessionsLength: data.sessions?.length || 0,
              hasActiveSession: !!activeSession,
              shouldSkipAutoselect,
              skipAutoselectValue: localStorage.getItem('skip-autoselect'),
            },
            'Auto-selection: checking conditions'
          )
          if (data.sessions.length > 0 && !activeSession && !shouldSkipAutoselect) {
            logger.debug('Auto-selection: conditions met, proceeding with auto-selection')
            logger.info('Condition met for auto-selection')
            const runningSession = data.sessions.find((s: Session) => s.status === 'running')
            const sessionToSelect = runningSession || data.sessions[0]
            logger.debug(
              {
                runningSessionId: runningSession?.id,
                firstSessionId: data.sessions[0]?.id,
                selectedSessionId: sessionToSelect.id,
                selectedSessionStatus: sessionToSelect.status,
              },
              'Auto-selection: selected session details'
            )
            logger.info({ sessionId: sessionToSelect.id }, 'Auto-selecting session')
            activeSessionRef.current = sessionToSelect
            setActiveSession(sessionToSelect)
            // Subscribe to the auto-selected session for live updates
            const readyState = wsRef.current?.readyState
            logger.debug(
              {
                sessionId: sessionToSelect.id,
                readyState,
                OPEN: WebSocket.OPEN,
                CONNECTING: WebSocket.CONNECTING,
                CLOSING: WebSocket.CLOSING,
                CLOSED: WebSocket.CLOSED,
              },
              'Auto-selection: checking WebSocket readyState for subscription'
            )
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
              logger.debug(
                { sessionId: sessionToSelect.id },
                'Auto-selection: WebSocket ready, sending subscribe message'
              )
              logger.info({ sessionId: sessionToSelect.id }, 'Subscribing to auto-selected session')
              wsRef.current.send(
                JSON.stringify({ type: 'subscribe', sessionId: sessionToSelect.id })
              )
              logger.info({ sessionId: sessionToSelect.id }, 'Subscription message sent')
            } else {
              logger.debug(
                { sessionId: sessionToSelect.id, readyState },
                'Auto-selection: WebSocket not ready, scheduling retry'
              )
              logger.warn(
                { sessionId: sessionToSelect.id, readyState },
                'WebSocket not ready for subscription, will retry'
              )
              setTimeout(() => {
                const retryReadyState = wsRef.current?.readyState
                logger.debug(
                  { sessionId: sessionToSelect.id, retryReadyState },
                  'Auto-selection: retry check for WebSocket subscription'
                )
                logger.info(
                  { sessionId: sessionToSelect.id, retryReadyState },
                  'Retry check for WebSocket subscription'
                )
                if (retryReadyState === WebSocket.OPEN && wsRef.current) {
                  logger.debug(
                    { sessionId: sessionToSelect.id },
                    'Auto-selection: retry successful, sending subscribe message'
                  )
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
                  logger.debug(
                    { sessionId: sessionToSelect.id, retryReadyState },
                    'Auto-selection: retry failed, WebSocket still not ready'
                  )
                  logger.error(
                    { sessionId: sessionToSelect.id, retryReadyState },
                    'WebSocket still not ready after retry'
                  )
                }
              }, 500) // Increased delay
            }
            // Load historical output for the auto-selected session
            logger.debug(
              { sessionId: sessionToSelect.id },
              'Auto-selection: fetching historical output'
            )
            fetch(
              `${location.protocol}//${location.host}/api/sessions/${sessionToSelect.id}/output`
            )
              .then((response) => {
                logger.debug(
                  { sessionId: sessionToSelect.id, ok: response.ok, status: response.status },
                  'Auto-selection: fetch output response'
                )
                return response.ok ? response.json() : []
              })
              .then((outputData) => {
                logger.debug(
                  { sessionId: sessionToSelect.id, linesCount: outputData.lines?.length },
                  'Auto-selection: setting historical output'
                )
                setOutput(outputData.lines || [])
              })
              .catch((error) => {
                logger.debug(
                  { sessionId: sessionToSelect.id, error },
                  'Auto-selection: failed to fetch historical output'
                )
                setOutput([])
              })
          } else {
            logger.debug('Auto-selection: conditions not met, skipping auto-selection')
          }
        } else if (data.type === 'data') {
          const isForActiveSession = data.sessionId === activeSessionRef.current?.id
          logger.debug(
            {
              dataSessionId: data.sessionId,
              activeSessionId: activeSessionRef.current?.id,
              isForActiveSession,
              dataLength: data.data?.length,
            },
            'WebSocket onmessage: received data message'
          )
          logger.info(
            {
              dataSessionId: data.sessionId,
              activeSessionId: activeSessionRef.current?.id,
              isForActiveSession,
            },
            'Received data message'
          )
          if (isForActiveSession) {
            logger.debug(
              { dataLength: data.data?.length, currentOutputLength: output.length },
              'Data message: processing for active session'
            )
            logger.info({ dataLength: data.data?.length }, 'Processing data for active session')
            setOutput((prev) => [...prev, ...data.data])
            wsMessageCountRef.current++
            setWsMessageCount(wsMessageCountRef.current)
            logger.debug(
              { wsMessageCountAfter: wsMessageCountRef.current },
              'Data message: WS message counter incremented'
            )
            logger.info(
              { wsMessageCountAfter: wsMessageCountRef.current },
              'WS message counter incremented'
            )
          } else {
            logger.debug(
              { dataSessionId: data.sessionId, activeSessionId: activeSessionRef.current?.id },
              'Data message: ignoring for inactive session'
            )
          }
        }
      } catch (error) {
        logger.error({ error }, 'Failed to parse WebSocket message')
      }
    }
    ws.onclose = (event) => {
      logger.debug(
        {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          readyState: ws.readyState,
        },
        'WebSocket onclose: connection closed'
      )
      logger.info('WebSocket disconnected')
      setConnected(false)
      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }
    }
    ws.onerror = (error) => {
      logger.debug(
        { error, readyState: ws.readyState },
        'WebSocket onerror: connection error occurred'
      )
      logger.error({ error }, 'WebSocket error')
    }
    wsRef.current = ws
    logger.debug('WebSocket useEffect: setup complete, returning cleanup function')
    return () => {
      logger.debug('WebSocket useEffect: cleanup function executing, closing WebSocket')
      ws.close()
    }
  }, [activeSession])

  // Initial session refresh as fallback - called during WebSocket setup

  const handleSessionClick = useCallback(async (session: Session) => {
    try {
      // Validate session object first
      if (!session?.id) {
        logger.error({ session }, 'Invalid session object passed to handleSessionClick')
        return
      }
      activeSessionRef.current = session
      setActiveSession(session)
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

  const handleSendInput = useCallback(
    async (data: string) => {
      if (!data.trim() || !activeSession) {
        return
      }

      try {
        const baseUrl = `${location.protocol}//${location.host}`
        const response = await fetch(`${baseUrl}/api/sessions/${activeSession.id}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        })

        if (!response.ok) {
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
    },
    [activeSession]
  )

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
            <div className="output-container">
              {output.length === 0 ? (
                <div className="empty-state">Waiting for output...</div>
              ) : (
                <TerminalRenderer
                  output={output}
                  onSendInput={handleSendInput}
                  onInterrupt={handleKillSession}
                  disabled={activeSession.status !== 'running'}
                />
              )}
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
