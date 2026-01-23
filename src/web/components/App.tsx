import { useState, useEffect, useRef, useCallback } from 'react'
import type { Session } from '../types.ts'
import pinoLogger from '../logger.ts'

import { Sidebar } from './Sidebar.tsx'
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
    const ws = new WebSocket(`ws://${location.host}`)
    ws.onopen = () => {
      logger.info('WebSocket connected')
      setConnected(true)
      // Request initial session list
      ws.send(JSON.stringify({ type: 'session_list' }))
      // Resubscribe to active session if exists
      if (activeSessionRef.current) {
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
            activeSessionRef.current = sessionToSelect
            // Reset WS message counter when switching sessions
            wsMessageCountRef.current = 0
            setWsMessageCount(0)
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
            fetch(
              `${location.protocol}//${location.host}/api/sessions/${sessionToSelect.id}/output`
            )
              .then((response) => {
                return response.ok ? response.json() : []
              })
              .then((outputData) => {
                setOutput(outputData.lines || [])
              })
              .catch(() => {
                setOutput([])
              })
          }
        } else if (data.type === 'data') {
          const isForActiveSession = data.sessionId === activeSessionRef.current?.id
          logger.info(
            {
              dataSessionId: data.sessionId,
              activeSessionId: activeSessionRef.current?.id,
              isForActiveSession,
            },
            'Received data message'
          )
          if (isForActiveSession) {
            logger.info({ dataLength: data.data?.length }, 'Processing data for active session')
            setOutput((prev) => [...prev, ...data.data])
            wsMessageCountRef.current++
            setWsMessageCount(wsMessageCountRef.current)
            logger.info(
              { wsMessageCountAfter: wsMessageCountRef.current },
              'WS message counter incremented'
            )
          }
        }
      } catch (error) {
        logger.error({ error }, 'Failed to parse WebSocket message')
      }
    }
    ws.onclose = () => {
      logger.info('WebSocket disconnected')
      setConnected(false)
      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }
    }
    ws.onerror = (error) => {
      logger.error({ error }, 'WebSocket error')
    }
    wsRef.current = ws
    return () => {
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
      // Reset WebSocket message counter when switching sessions
      wsMessageCountRef.current = 0
      setWsMessageCount(0)
      setActiveSession(session)

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
      if (!data || !activeSession) {
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

    if (
      !confirm(
        `Are you sure you want to kill session "${activeSession.description ?? activeSession.title}"?`
      )
    ) {
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
        // Reset WebSocket message counter when no session is active
        wsMessageCountRef.current = 0
        setWsMessageCount(0)
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
    <div className="container" data-active-session={activeSession?.id}>
      <Sidebar
        sessions={sessions}
        activeSession={activeSession}
        onSessionClick={handleSessionClick}
        connected={connected}
      />
      <div className="main">
        {activeSession ? (
          <>
            <div className="output-header">
              <div className="output-title">{activeSession.description ?? activeSession.title}</div>
              <button className="kill-btn" onClick={handleKillSession}>
                Kill Session
              </button>
            </div>
            <div className="output-container">
              <TerminalRenderer
                output={output}
                onSendInput={handleSendInput}
                onInterrupt={handleKillSession}
                disabled={!activeSession || activeSession.status !== 'running'}
              />
            </div>
            {/* Hidden output for testing purposes */}
            <div
              style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}
              data-testid="test-output"
            >
              {output.map((line, i) => (
                <div key={i} className="output-line">
                  {line}
                </div>
              ))}
            </div>
            <div className="debug-info" data-testid="debug-info">
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
