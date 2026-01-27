import { useCallback } from 'react'
import type { Session } from 'opencode-pty-test/shared/types'
import pinoLogger from 'opencode-pty-test/shared/logger'

const logger = pinoLogger.child({ module: 'useSessionManager' })

interface UseSessionManagerOptions {
  activeSession: Session | null
  setActiveSession: (session: Session | null) => void
  subscribeWithRetry: (sessionId: string) => void
  onOutputUpdate?: (output: string[]) => void
  onRawOutputUpdate?: (rawOutput: string) => void
}

export function useSessionManager({
  activeSession,
  setActiveSession,
  subscribeWithRetry,
  onOutputUpdate,
  onRawOutputUpdate,
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
        onOutputUpdate?.([])
        onRawOutputUpdate?.('')
        // Subscribe to this session for live updates
        subscribeWithRetry(session.id)

        try {
          const baseUrl = `${location.protocol}//${location.host}`

          // Fetch raw buffer data only (processed output endpoint removed)
          const rawResponse = await fetch(`${baseUrl}/api/sessions/${session.id}/buffer/raw`)

          // Process response with graceful error handling
          const rawData = rawResponse.ok ? await rawResponse.json() : { raw: '' }

          // Call callback with raw data
          onRawOutputUpdate?.(rawData.raw || '')
        } catch (fetchError) {
          logger.error({ error: fetchError }, 'Network error fetching session data')
          onOutputUpdate?.([])
          onRawOutputUpdate?.('')
        }
      } catch (error) {
        logger.error({ error }, 'Unexpected error in handleSessionClick')
        // Ensure UI remains stable
        onOutputUpdate?.([])
        onRawOutputUpdate?.('')
      }
    },
    [setActiveSession, subscribeWithRetry, onOutputUpdate, onRawOutputUpdate]
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
        onOutputUpdate?.([])
        onRawOutputUpdate?.('')
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
