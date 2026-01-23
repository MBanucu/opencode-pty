import { useCallback } from 'react'
import type { Session } from '../types.ts'
import pinoLogger from '../logger.ts'

const logger = pinoLogger.child({ module: 'useSessionManager' })

interface UseSessionManagerOptions {
  activeSession: Session | null
  setActiveSession: (session: Session | null) => void
  subscribeWithRetry: (sessionId: string) => void
  onOutputUpdate: (output: string[], rawOutput: string) => void
}

export function useSessionManager({
  activeSession,
  setActiveSession,
  subscribeWithRetry,
  onOutputUpdate,
}: UseSessionManagerOptions) {
  const handleSessionClick = useCallback(
    async (session: Session) => {
      try {
        // Validate session object first
        if (!session?.id) {
          logger.error({ session }, 'Invalid session object passed to handleSessionClick')
          return
        }
        setActiveSession(session)
        onOutputUpdate([], '')
        // Subscribe to this session for live updates
        subscribeWithRetry(session.id)

        try {
          const baseUrl = `${location.protocol}//${location.host}`
          const response = await fetch(`${baseUrl}/api/sessions/${session.id}/buffer/raw`)

          if (response.ok) {
            const outputData = await response.json()
            onOutputUpdate(
              outputData.raw
                ? outputData.raw.split('\n').filter((line: string) => line !== '')
                : [],
              outputData.raw || ''
            )
          } else {
            const errorText = await response.text().catch(() => 'Unable to read error response')
            logger.error({ status: response.status, error: errorText }, 'Fetch failed')
            onOutputUpdate([], '')
          }
        } catch (fetchError) {
          logger.error({ error: fetchError }, 'Network error fetching output')
          onOutputUpdate([], '')
        }
      } catch (error) {
        logger.error({ error }, 'Unexpected error in handleSessionClick')
        // Ensure UI remains stable
        onOutputUpdate([], '')
      }
    },
    [subscribeWithRetry, onOutputUpdate]
  )

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
        onOutputUpdate([], '')
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
  }, [activeSession, onOutputUpdate])

  return {
    handleSessionClick,
    handleSendInput,
    handleKillSession,
  }
}
