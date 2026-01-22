import pino from 'pino'

/**
 * Create a Pino logger for tests with appropriate formatting
 * Uses console output for easier debugging in test environments
 */
export function createTestLogger(module: string) {
  return pino({
    level: process.env.LOG_LEVEL || 'warn', // Default to warn level for quieter test output
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname,module',
        messageFormat: `[${module}] {msg}`,
      },
    },
  }).child({ module })
}