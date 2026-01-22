import pino from 'pino'

// Determine environment - in Vite, use import.meta.env
const isDevelopment = import.meta.env.DEV
const isTest = import.meta.env.MODE === 'test'

// Determine log level
const logLevel: pino.Level = isTest ? 'warn' : isDevelopment ? 'debug' : 'info'

// Create Pino logger for browser with basic configuration
const logger = pino({
  level: logLevel,
  browser: {
    asObject: true, // Always log as objects
  },
  serializers: {
    error: pino.stdSerializers.err,
  },
})

// Create child logger factory for specific modules
export const createLogger = (module: string) => logger.child({ module })

// Default app logger
export default logger