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

// Default app logger
export default pinoLogger
