import pino from 'pino'
import type { PluginClient } from './types.ts'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface Logger {
  debug(message: string, extra?: Record<string, unknown>): void
  info(message: string, extra?: Record<string, unknown>): void
  warn(message: string, extra?: Record<string, unknown>): void
  error(message: string, extra?: Record<string, unknown>): void
}

let _client: PluginClient | null = null
let _pinoLogger: pino.Logger | null = null

// Create Pino logger with pretty printing in development
function createPinoLogger() {
  const isProduction = process.env.NODE_ENV === 'production'

  return pino({
    level: process.env.LOG_LEVEL || 'info',
    ...(isProduction
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
        }),
  })
}

export function initLogger(client: PluginClient): void {
  _client = client
  // Also create Pino logger as fallback
  _pinoLogger = createPinoLogger()
}

export function createLogger(module: string): Logger {
  const service = `pty.${module}`

  // Initialize Pino logger if not done yet
  if (!_pinoLogger) {
    _pinoLogger = createPinoLogger()
  }

  const log = (level: LogLevel, message: string, extra?: Record<string, unknown>): void => {
    const logData = extra ? { ...extra, service } : { service }

    if (_client) {
      // Use OpenCode plugin logging when available
      _client.app
        .log({
          body: { service, level, message, extra },
        })
        .catch(() => {})
    } else {
      // Use Pino logger as fallback
      _pinoLogger![level](logData, message)
    }
  }

  return {
    debug: (message, extra) => log('debug', message, extra),
    info: (message, extra) => log('info', message, extra),
    warn: (message, extra) => log('warn', message, extra),
    error: (message, extra) => log('error', message, extra),
  }
}
