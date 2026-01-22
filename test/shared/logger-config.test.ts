import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { getLogLevel } from '../../src/shared/logger-config.ts'

describe('Logger Configuration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment variables before each test
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('getLogLevel', () => {
    it('should return LOG_LEVEL env var if set', () => {
      process.env.LOG_LEVEL = 'error'
      expect(getLogLevel()).toBe('error')

      process.env.LOG_LEVEL = 'debug'
      expect(getLogLevel()).toBe('debug')
    })

    it('should return "debug" when CI=true', () => {
      process.env.CI = 'true'
      expect(getLogLevel()).toBe('debug')
    })

    it('should return "warn" when NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test'
      expect(getLogLevel()).toBe('warn')
    })

    it('should return "info" for other environments', () => {
      process.env.NODE_ENV = 'development'
      expect(getLogLevel()).toBe('info')

      process.env.NODE_ENV = 'production'
      expect(getLogLevel()).toBe('info')
    })

    it('should prioritize LOG_LEVEL over CI', () => {
      process.env.LOG_LEVEL = 'trace'
      process.env.CI = 'true'
      expect(getLogLevel()).toBe('trace')
    })

    it('should prioritize LOG_LEVEL over NODE_ENV', () => {
      process.env.LOG_LEVEL = 'fatal'
      process.env.NODE_ENV = 'test'
      expect(getLogLevel()).toBe('fatal')
    })

    it('should support all valid Pino log levels', () => {
      const validLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const

      validLevels.forEach((level) => {
        process.env.LOG_LEVEL = level
        expect(getLogLevel()).toBe(level)
      })
    })
  })
})
