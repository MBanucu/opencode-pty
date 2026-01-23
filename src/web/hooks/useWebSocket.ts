import { useState, useEffect, useRef } from 'react'
import type { Session } from '../types.ts'
import pinoLogger from '../logger.ts'
import { WEBSOCKET_PING_INTERVAL, RETRY_DELAY, SKIP_AUTOSELECT_KEY } from '../constants.ts'

const logger = pinoLogger.child({ module: 'useWebSocket' })

interface UseWebSocketOptions {
  activeSession: Session | null
  onData: (lines: string[]) => void
  onSessionList: (sessions: Session[], autoSelected: Session | null) => void
}

export function useWebSocket({ activeSession, onData, onSessionList }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const activeSessionRef = useRef<Session | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Keep ref in sync with activeSession
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
      }, WEBSOCKET_PING_INTERVAL)
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
          const sessions = data.sessions || []
          // Auto-select first running session if none selected (skip in tests that need empty state)
          const shouldSkipAutoselect = localStorage.getItem(SKIP_AUTOSELECT_KEY) === 'true'
          let autoSelected: Session | null = null
          if (sessions.length > 0 && !activeSession && !shouldSkipAutoselect) {
            logger.info('Condition met for auto-selection')
            const runningSession = sessions.find((s: Session) => s.status === 'running')
            autoSelected = runningSession || sessions[0]
            if (autoSelected) {
              logger.info({ sessionId: autoSelected!.id }, 'Auto-selecting session')
              activeSessionRef.current = autoSelected
              // Subscribe to the auto-selected session for live updates
              const readyState = wsRef.current?.readyState
              logger.info(
                {
                  sessionId: autoSelected!.id,
                  readyState,
                  OPEN: WebSocket.OPEN,
                  CONNECTING: WebSocket.CONNECTING,
                },
                'Checking WebSocket state for subscription'
              )

              if (readyState === WebSocket.OPEN && wsRef.current) {
                logger.info({ sessionId: autoSelected!.id }, 'Subscribing to auto-selected session')
                wsRef.current.send(
                  JSON.stringify({ type: 'subscribe', sessionId: autoSelected!.id })
                )
                logger.info({ sessionId: autoSelected!.id }, 'Subscription message sent')
              } else {
                logger.warn(
                  { sessionId: autoSelected!.id, readyState },
                  'WebSocket not ready for subscription, will retry'
                )
                setTimeout(() => {
                  const retryReadyState = wsRef.current?.readyState
                  logger.info(
                    { sessionId: autoSelected!.id, retryReadyState },
                    'Retry check for WebSocket subscription'
                  )
                  if (retryReadyState === WebSocket.OPEN && wsRef.current) {
                    logger.info(
                      { sessionId: autoSelected!.id },
                      'Subscribing to auto-selected session (retry)'
                    )
                    wsRef.current.send(
                      JSON.stringify({ type: 'subscribe', sessionId: autoSelected!.id })
                    )
                    logger.info(
                      { sessionId: autoSelected!.id },
                      'Subscription message sent (retry)'
                    )
                  } else {
                    logger.error(
                      { sessionId: autoSelected!.id, retryReadyState },
                      'WebSocket still not ready after retry'
                    )
                  }
                }, RETRY_DELAY)
              }
            }
          }
          onSessionList(sessions, autoSelected)
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
            onData(data.data)
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
  }, [activeSession, onData, onSessionList])

  const subscribe = (sessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', sessionId }))
    }
  }

  const subscribeWithRetry = (sessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      subscribe(sessionId)
    } else {
      setTimeout(() => {
        subscribe(sessionId)
      }, RETRY_DELAY)
    }
  }

  return { connected, subscribe, subscribeWithRetry }
}
