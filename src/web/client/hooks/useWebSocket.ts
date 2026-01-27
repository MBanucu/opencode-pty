import { useState, useEffect, useRef } from 'react'
import type { Session } from 'opencode-pty-test/shared/types'
import {
  WEBSOCKET_PING_INTERVAL,
  RETRY_DELAY,
  SKIP_AUTOSELECT_KEY,
} from 'opencode-pty-test/shared/constants'

interface UseWebSocketOptions {
  activeSession: Session | null
  onRawData?: (rawData: string) => void
  onSessionList: (sessions: Session[], autoSelected: Session | null) => void
}

export function useWebSocket({ activeSession, onRawData, onSessionList }: UseWebSocketOptions) {
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
    const ws = new WebSocket(`ws://${location.host}/ws`)
    ws.onopen = () => {
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
        if (data.type === 'session_list') {
          const sessions = data.sessions || []
          // Auto-select first running session if none selected (skip in tests that need empty state)
          const shouldSkipAutoselect = localStorage.getItem(SKIP_AUTOSELECT_KEY) === 'true'
          let autoSelected: Session | null = null
          if (sessions.length > 0 && !activeSession && !shouldSkipAutoselect) {
            const runningSession = sessions.find((s: Session) => s.status === 'running')
            autoSelected = runningSession || sessions[0]
            if (autoSelected) {
              activeSessionRef.current = autoSelected
              // Subscribe to the auto-selected session for live updates
              const readyState = wsRef.current?.readyState

              if (readyState === WebSocket.OPEN && wsRef.current) {
                wsRef.current.send(
                  JSON.stringify({ type: 'subscribe', sessionId: autoSelected!.id })
                )
              } else {
                setTimeout(() => {
                  const retryReadyState = wsRef.current?.readyState
                  if (retryReadyState === WebSocket.OPEN && wsRef.current) {
                    wsRef.current.send(
                      JSON.stringify({ type: 'subscribe', sessionId: autoSelected!.id })
                    )
                  }
                }, RETRY_DELAY)
              }
            }
          }
          onSessionList(sessions, autoSelected)
        } else if (data.type === 'raw_data') {
          const isForActiveSession = data.sessionId === activeSessionRef.current?.id
          if (isForActiveSession) {
            onRawData?.(data.rawData)
          }
        }
        // eslint-disable-next-line no-empty
      } catch { }
    }
    ws.onclose = () => {
      setConnected(false)
      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }
    }
    ws.onerror = () => { }
    wsRef.current = ws
    return () => {
      ws.close()
    }
  }, [activeSession, onRawData, onSessionList])

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
