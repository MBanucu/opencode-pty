import pino, { type LevelWithSilentOrString } from 'pino'
import { getLogLevel } from '../../shared/logger-config.ts'

// Determine environment - use process.env for consistency with plugin logger
const isDevelopment = process.env.NODE_ENV !== 'production'
const isTest = process.env.NODE_ENV === 'test'

// Determine log level
const logLevel: LevelWithSilentOrString = getLogLevel()

// Create Pino logger for web with basic configuration
const pinoLogger = pino({
  level: logLevel,
  serializers: {
    error: pino.stdSerializers.err,
  },
  // Use ISO timestamps for better parsing
  timestamp: pino.stdTimeFunctions.isoTime,
  // Use transports for pretty printing in non-production
  transport:
    !isDevelopment && !isTest
      ? undefined
      : {
          targets: [
            {
              target: 'pino-pretty',
              level: logLevel,
              options: {
                colorize: true,
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l o',
                ignore: 'pid,hostname',
                singleLine: true,
              },
            },
          ],
        },
})

// Default app logger
export default pinoLogger
