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

// Create Pino logger with production best practices
function createPinoLogger() {
  const isProduction = process.env.NODE_ENV === 'production'

  return pino({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'warn' : 'info'),

    // Format level as string for better readability
    formatters: {
      level: (label) => ({ level: label }),
    },

    // Base context for all logs
    base: {
      service: 'opencode-pty',
      env: process.env.NODE_ENV || 'development',
      version: '1.0.0', // TODO: Read from package.json
    },

    // Redaction for any sensitive data (expand as needed)
    redact: {
      paths: ['password', 'token', 'secret', '*.password', '*.token', '*.secret'],
      remove: true,
    },

    // Use ISO timestamps for better parsing
    timestamp: pino.stdTimeFunctions.isoTime,

    // Pretty printing only in development (not production)
    ...(isProduction
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'yyyy-mm-dd HH:MM:ss.l o',
              ignore: 'pid,hostname',
              singleLine: true,
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

// Convenience function for creating child loggers (recommended pattern)
export function getLogger(context: Record<string, unknown> = {}): Logger {
  // Initialize Pino logger if not done yet
  if (!_pinoLogger) {
    _pinoLogger = createPinoLogger()
  }

  // Create child logger with context
  const childLogger = _pinoLogger!.child(context)

  return {
    debug: (message, extra) => childLogger.debug(extra || {}, message),
    info: (message, extra) => childLogger.info(extra || {}, message),
    warn: (message, extra) => childLogger.warn(extra || {}, message),
    error: (message, extra) => childLogger.error(extra || {}, message),
  }
}
