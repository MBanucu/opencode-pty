import pino from 'pino'

// Determine environment - in Vite, use import.meta.env
const isDevelopment = import.meta.env.DEV
const isTest = import.meta.env.MODE === 'test'

// Determine log level
const logLevel: pino.Level = process.env.CI
  ? 'debug'
  : isTest
    ? 'warn'
    : isDevelopment
      ? 'debug'
      : 'info'

// Create Pino logger for browser with basic configuration
const pinoLogger = pino({
  level: logLevel,
  browser: {
    asObject: true, // Always log as objects
  },
  serializers: {
    error: pino.stdSerializers.err,
  },
})

// Create child logger factory for specific modules
export const createLogger = (module: string) => pinoLogger.child({ module })

// Convenience function for creating child loggers (recommended pattern)
export const getLogger = (context: Record<string, unknown> = {}) => pinoLogger.child(context)

// Default app logger
export default pinoLogger
