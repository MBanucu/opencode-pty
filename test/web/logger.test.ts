import { describe, it, expect } from 'bun:test'

describe('Web Logger', () => {
  // Note: Web logger is client-side, so limited testing possible in Node environment

  it('should export a default logger', async () => {
    // Dynamic import to avoid issues in Node environment
    const { default: logger } = await import('../../src/web/shared/logger.ts')

    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
  })

  it('should have logger methods', async () => {
    const { default: logger } = await import('../../src/web/shared/logger.ts')

    // These should not throw (though they may not log in Node environment)
    expect(() => logger.info('test')).not.toThrow()
    expect(() => logger.debug('debug test')).not.toThrow()
    expect(() => logger.error('error test')).not.toThrow()
  })
})
