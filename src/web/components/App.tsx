import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { Session } from '../types.ts'

// Configure logger - reduce logging in test environment
const isTest =
  typeof window !== 'undefined' &&
  window.location?.hostname === 'localhost' &&
  window.location?.port === '8867'
const logger = {
  info: (...args: any[]) => {
    if (!isTest) console.log(...args)
  },
  error: (...args: any[]) => console.error(...args),
}

export function App() {
  if (!isTest) logger.info('[Browser] App component rendering/mounting')

  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [output, setOutput] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [connected, setConnected] = useState(false)
  const [autoSelected, setAutoSelected] = useState(false)
  const [wsMessageCount, setWsMessageCount] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const activeSessionRef = useRef<Session | null>(null)

  const refreshSessions = useCallback(async () => {
    try {
      const baseUrl = `${location.protocol}//${location.host}`
      const response = await fetch(`${baseUrl}/api/sessions`)
      if (response.ok) {
        const sessions = await response.json()
        setSessions(Array.isArray(sessions) ? sessions : [])
        logger.info('[Browser] Refreshed sessions:', sessions.length)
      }
    } catch (error) {
      logger.error('[Browser] Failed to refresh sessions:', error)
    }
  }, [])

  const handleSessionClick = useCallback(async (session: Session) => {
    logger.info('[Browser] handleSessionClick called with session:', session.id, session.status)
    try {
      // Validate session object first
      if (!session?.id) {
        logger.error('[Browser] Invalid session object passed to handleSessionClick:', session)
        return
      }

      logger.info('[Browser] Setting active session:', session.id)
      setActiveSession(session)
      setInputValue('')

      // Subscribe to this session for live updates
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        logger.info('[Browser] Subscribing to session for live updates:', session.id)
        wsRef.current.send(JSON.stringify({ type: 'subscribe', sessionId: session.id }))
      } else {
        logger.info('[Browser] WebSocket not ready for subscription, retrying in 100ms')
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            logger.info('[Browser] Subscribing to session for live updates (retry):', session.id)
            wsRef.current.send(JSON.stringify({ type: 'subscribe', sessionId: session.id }))
          }
        }, 100)
      }

      // Always fetch output (buffered content for all sessions)
      logger.info('[Browser] Fetching output for session:', session.id, 'status:', session.status)

      try {
        const baseUrl = `${location.protocol}//${location.host}`
        logger.info(
          '[Browser] Making fetch request to:',
          `${baseUrl}/api/sessions/${session.id}/output`
        )

        const response = await fetch(`${baseUrl}/api/sessions/${session.id}/output`)
        logger.info('[Browser] Fetch completed, response status:', response.status)

        if (response.ok) {
          const outputData = await response.json()
          logger.info('[Browser] Successfully parsed JSON, lines:', outputData.lines?.length || 0)
          logger.info('[Browser] Setting output with lines:', outputData.lines)
          setOutput(outputData.lines || [])
          logger.info('[Browser] Output state updated')
        } else {
          const errorText = await response.text().catch(() => 'Unable to read error response')
          logger.error('[Browser] Fetch failed - Status:', response.status, 'Error:', errorText)
          setOutput([])
        }

      } catch (fetchError) {
        logger.error('[Browser] Network error fetching output:', fetchError)
        setOutput([])
      }
      logger.info(`[Browser] Fetch process completed for ${session.id}`)
    } catch (error) {
      logger.error('[Browser] Unexpected error in handleSessionClick:', error)
      // Ensure UI remains stable
      setOutput([])
    }
  }, [])

  const handleSendInput = useCallback(async () => {
        const errorText = await response.text().catch(() => 'Unable to read error response')
        logger.error(
          '[Browser] Failed to kill session - Status:',
          response.status,
          response.statusText,
          'Error:',
          errorText
        )
      }
    } catch (error) {
      logger.error('[Browser] Network error killing session:', error)
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

              {/* Debug info */}
              <div
                style={{
                  fontSize: '10px',
                  color: '#666',
                  marginTop: '10px',
                  borderTop: '1px solid #ccc',
                  paddingTop: '5px',
                }}
              >
                Debug: {output.length} lines, active: {activeSession?.id || 'none'}, WS messages:{' '}
                {wsMessageCount}
              </div>
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
          </>
        ) : (
          <div className="empty-state">Select a session from the sidebar to view its output</div>
        )}
      </div>
    </div>
  )
}
