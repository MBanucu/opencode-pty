import pino from 'pino'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { PluginClient } from './types.ts'

// Get package version from package.json
function getPackageVersion(): string {
  try {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
    return packageJson.version || '1.0.0'
  } catch {
    return '1.0.0'
  }
}

let _client: PluginClient | null = null

const isProduction = process.env.NODE_ENV === 'production'
const logLevel =
  process.env.LOG_LEVEL ||
  (process.env.CI ? 'debug' : process.env.NODE_ENV === 'test' ? 'warn' : 'info')

// Create Pino logger with production best practices
const pinoLogger = pino({
  level: logLevel,

  // Base context for all logs
  base: {
    service: 'opencode-pty',
    env: process.env.NODE_ENV || 'development',
    version: getPackageVersion(),
  },

  // Redaction for any sensitive data (expand as needed)
  redact: {
    paths: ['password', 'token', 'secret', '*.password', '*.token', '*.secret'],
    remove: true,
  },

  // Use ISO timestamps for better parsing
  timestamp: pino.stdTimeFunctions.isoTime,

  // Hook to send logs to OpenCode when available
  hooks: {
    logMethod(args, method) {
      if (_client && !process.env.CI) {
        const obj = args[0] || {}
        const msg = args[1] || ''
        _client.app
          .log({
            body: {
              service: 'opencode-pty',
              level: method.name as 'debug' | 'warn' | 'info' | 'error',
              message: msg,
              extra: obj as Record<string, unknown>,
            },
          })
          .catch(() => {})
      }
      method.apply(this, args)
    },
  },

  // Use transports for pretty printing
  transport: {
    targets: [
      {
        target: isProduction ? 'pino/file' : 'pino-pretty',
        level: logLevel,
        options: {
          ...(isProduction
            ? {
                destination: 1, // stdout
                mkdir: true,
                sync: true,
              }
            : {
                colorize: true,
                translateTime: 'yyyy-mm-dd HH:MM:ss.l o',
                ignore: 'pid,hostname',
                singleLine: true,
                sync: true,
              }),
        },
      },
    ],
  },
})

export function initLogger(client: PluginClient): void {
  _client = client
}

export function createLogger(service: string): pino.Logger {
  return pinoLogger.child({ service })
}

export function getLogger(context: Record<string, unknown> = {}): pino.Logger {
  return pinoLogger.child(context)
}

export default pinoLogger
