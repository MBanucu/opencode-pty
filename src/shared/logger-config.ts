// Shared logger configuration
import type { LevelWithSilentOrString } from 'pino'

export function getLogLevel(): LevelWithSilentOrString {
  return (
    (process.env.LOG_LEVEL as LevelWithSilentOrString) ||
    (process.env.CI ? 'debug' : process.env.NODE_ENV === 'test' ? 'warn' : 'info')
  )
}
